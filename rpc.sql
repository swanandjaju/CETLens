-- ═══════════════════════════════════════════════════════════════════════════════
-- CETLens — RPC functions
-- Run this entire file in the Supabase SQL Editor after schema.sql.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── identify_sheet: lightweight global signature lookup ──────────────────────
-- Given a signature, searches ALL locked signatures across all streams/attempts
-- and returns the correct stream/attempt/shift. Returns NULL if not found.
-- Used by the frontend to auto-detect where a sheet belongs BEFORE submission.
DROP FUNCTION IF EXISTS identify_sheet(text);

CREATE OR REPLACE FUNCTION identify_sheet(p_signature TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT stream, attempt, shift, votes INTO v_result
    FROM shift_signatures
   WHERE signature = p_signature
     AND votes >= CASE WHEN stream = 'PCM' THEN 35 ELSE 10 END
   ORDER BY votes DESC
   LIMIT 1;

  IF v_result.stream IS NOT NULL THEN
    RETURN jsonb_build_object(
      'stream',  v_result.stream,
      'attempt', v_result.attempt,
      'shift',   v_result.shift
    );
  END IF;

  RETURN NULL;
END;
$$;

-- ── record_submission: main submission RPC ───────────────────────────────────
DROP FUNCTION IF EXISTS record_submission(text,text,text,integer,jsonb,text);
DROP FUNCTION IF EXISTS record_submission(text,text,text,integer,jsonb,text,text);

CREATE OR REPLACE FUNCTION record_submission(
  p_stream     TEXT,
  p_attempt    TEXT,
  p_shift      TEXT,
  p_score      INTEGER,
  p_subjects   JSONB,
  p_hash       TEXT,
  p_signature  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_max_score   INTEGER;
  v_clamped     INTEGER;
  v_inserted    BOOLEAN;
  v_rank_above  BIGINT := 0;
  v_shift_count INTEGER := 0;
  v_sc          JSONB;
  v_key         TEXT;
  v_val         NUMERIC;
  v_existing    JSONB;
  v_new_sums    JSONB;
  v_recent      INTEGER;
  v_client_ip   TEXT;
  v_ip_hash     CHAR(64);
  -- Signature detection variables
  v_threshold   INTEGER;
  v_locked_sig  TEXT;
  v_locked_shift TEXT;
  v_locked_stream TEXT;
  v_locked_attempt TEXT;
BEGIN
  -- ── 0a. Input validation ──────────────────────────────────────────────────
  -- Stream must be PCM or PCB
  IF p_stream NOT IN ('PCM', 'PCB') THEN
    RETURN jsonb_build_object('error', 'invalid_stream');
  END IF;

  -- Attempt must be from the known whitelist
  IF p_attempt IS NULL OR p_attempt NOT IN ('Attempt 1', 'Attempt 2') THEN
    RETURN jsonb_build_object('error', 'invalid_attempt');
  END IF;

  -- ── 0a. Data Collection Pause ──────────────────────────────────────────────
  -- Attempt 1 is currently frozen. Attempt 2 is open for data collection.
  IF p_attempt = 'Attempt 1' THEN
    RETURN jsonb_build_object(
      'duplicate',   false,
      'rank_above',  0,
      'shift_count', 0
    );
  END IF;

  -- Shift must be from the known whitelist (all valid CET exam shifts)
  IF p_shift IS NULL OR p_shift NOT IN (
    '11 April - Morning', '11 April - Evening',
    '13 April - Morning', '13 April - Evening',
    '15 April - Morning', '15 April - Evening',
    '16 April - Morning', '16 April - Evening',
    '17 April - Morning', '17 April - Evening',
    '18 April - Morning', '18 April - Evening',
    '19 April - Morning', '19 April - Evening',
    '20 April - Morning', '20 April - Evening',
    '21 April - Morning', '21 April - Evening',
    '22 April - Morning', '22 April - Evening',
    '23 April - Morning', '23 April - Evening',
    '24 April - Morning', '24 April - Evening',
    '25 April - Morning', '25 April - Evening',
    '26 April - Morning', '26 April - Evening',
    '10 May - Morning', '10 May - Evening',
    '11 May - Morning', '11 May - Evening',
    '12 May - Morning', '12 May - Evening',
    '13 May - Morning', '13 May - Evening',
    '14 May - Morning', '14 May - Evening',
    '15 May - Morning', '15 May - Evening',
    '18 May - Morning', '18 May - Evening',
    '19 May - Morning', '19 May - Evening',
    '20 May - Morning'
  ) THEN
    RETURN jsonb_build_object('error', 'invalid_shift');
  END IF;

  -- Hash must be a valid SHA-256 hex string (64 lowercase hex chars)
  IF p_hash IS NULL OR length(p_hash) != 64 OR p_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('error', 'invalid_hash');
  END IF;

  -- Score must be non-negative
  IF p_score < 0 THEN
    RETURN jsonb_build_object('error', 'invalid_score');
  END IF;

  -- Extract and hash the client IP to prevent abuse without storing PII
  v_client_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  v_client_ip := COALESCE(v_client_ip, 'unknown_ip');
  v_ip_hash := encode(digest(v_client_ip || 'cetlens_salt_2026', 'sha256'), 'hex');

  -- ── 0b. Score cap — silently reject suspiciously high scores ────────────
  -- Scores above 185 are almost certainly fabricated response sheets.
  -- We still record the hash (to block re-uploads) but do NOT add the score
  -- to shift_stats. The student sees their dashboard normally.
  IF p_score > 185 THEN
    -- Record hash so they can't resubmit
    INSERT INTO submission_hashes (hash, stream, attempt, shift, ip_hash)
    VALUES (p_hash, p_stream, p_attempt, p_shift, v_ip_hash)
    ON CONFLICT (hash) DO NOTHING;

    -- Return a normal-looking success response
    RETURN jsonb_build_object(
      'duplicate',   false,
      'rank_above',  0,
      'shift_count', 0
    );
  END IF;

  -- Subject keys must be valid names only
  IF p_subjects IS NOT NULL AND p_subjects != '{}'::jsonb THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_each_text(p_subjects) AS t(k, v)
      WHERE k NOT IN ('Physics', 'Chemistry', 'Mathematics', 'Biology')
    ) THEN
      RETURN jsonb_build_object('error', 'invalid_subjects');
    END IF;
  END IF;

  -- ── 0b. Zero-score rejection ──────────────────────────────────────────────
  -- Block submissions where total score = 0 AND all subject scores are 0.
  -- A real student who sat the exam would almost certainly score > 0 somewhere.
  IF p_score = 0 THEN
    IF p_subjects IS NULL OR p_subjects = '{}'::jsonb OR NOT EXISTS (
      SELECT 1 FROM jsonb_each_text(p_subjects) AS t(k, v)
      WHERE v::numeric > 0
    ) THEN
      RETURN jsonb_build_object('error', 'zero_submission');
    END IF;
  END IF;

  -- ── 0c. Rate limiting & Sybil Resistance ──────────────────────────────────
  -- 1. Per-IP Rate Limit (Max 15 submissions per minute)
  SELECT COUNT(*) INTO v_recent
    FROM submission_hashes
   WHERE ip_hash = v_ip_hash
     AND created_at > now() - interval '1 minute';

  IF v_recent >= 15 THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  -- 2. Global Rate Limit (Max 1000 per minute to prevent DB DoS)
  SELECT COUNT(*) INTO v_recent
    FROM submission_hashes
   WHERE created_at > now() - interval '1 minute';

  IF v_recent >= 1000 THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  -- 3. Sybil Resistance (Max 3 submissions per shift per IP)
  SELECT COUNT(*) INTO v_recent
    FROM submission_hashes
   WHERE ip_hash = v_ip_hash
     AND stream = p_stream
     AND attempt = p_attempt
     AND shift = p_shift;

  IF v_recent >= 3 THEN
    -- Silently discard to prevent data poisoning and signature hijacking.
    -- We still record the hash so they can't spam the exact same file,
    -- and we return a success-like object so the client dashboard renders.
    INSERT INTO submission_hashes (hash, stream, attempt, shift, ip_hash)
    VALUES (p_hash, p_stream, p_attempt, p_shift, v_ip_hash)
    ON CONFLICT (hash) DO NOTHING;

    RETURN jsonb_build_object(
      'duplicate',   false,
      'rank_above',  0,
      'shift_count', 0
    );
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- ── 0d. SHIFT SIGNATURE DETECTION (self-learning fingerprint system) ─────
  -- ══════════════════════════════════════════════════════════════════════════
  --
  -- Physics Question IDs are unique per shift. We use the first N sorted
  -- Physics QIDs as a "signature" to fingerprint each shift's question paper.
  --
  -- Learning phase: Accept all submissions, record signature votes.
  -- Lock-in phase:  Once a signature reaches the threshold for a shift,
  --                 reject any submission whose signature doesn't match.
  --
  -- Threshold: 35 matching votes for PCM, 10 for PCB.

  IF p_signature IS NOT NULL AND length(p_signature) > 0 THEN
    -- Set threshold based on stream
    v_threshold := CASE WHEN p_stream = 'PCM' THEN 35 ELSE 10 END;

    -- GLOBAL CHECK: Search ALL streams/attempts for this exact signature.
    -- This catches users who selected the completely wrong stream or attempt.
    SELECT stream, attempt, shift INTO v_locked_stream, v_locked_attempt, v_locked_shift
      FROM shift_signatures
     WHERE signature = p_signature
       AND votes >= CASE WHEN stream = 'PCM' THEN 35 ELSE 10 END
     ORDER BY votes DESC
     LIMIT 1;

    IF v_locked_stream IS NOT NULL THEN
      -- Found a locked match! Check if it differs from what the user provided.
      IF v_locked_stream != p_stream OR v_locked_attempt != p_attempt OR v_locked_shift != p_shift THEN
        RETURN jsonb_build_object(
          'error',           'wrong_shift_detected',
          'correct_stream',  v_locked_stream,
          'correct_attempt', v_locked_attempt,
          'correct_shift',   v_locked_shift
        );
      END IF;
    END IF;

    -- CHECK 2: Has this shift already locked in a DIFFERENT signature?
    -- (i.e., shift "11 May Morning" is locked to Signature A, but this student
    --  is uploading Signature B into it)
    SELECT signature INTO v_locked_sig
      FROM shift_signatures
     WHERE stream = p_stream
       AND attempt = p_attempt
       AND shift = p_shift
       AND votes >= v_threshold
     LIMIT 1;

    IF v_locked_sig IS NOT NULL AND v_locked_sig != p_signature THEN
      -- This shift already has a locked signature and this isn't it!
      -- We don't know which shift the student's paper belongs to (it might be
      -- a shift we haven't seen yet), so just reject without suggesting.
      RETURN jsonb_build_object(
        'error', 'wrong_shift_detected'
      );
    END IF;

  END IF;

  -- ══════════════════════════════════════════════════════════════════════════

  -- ── 1. Clamp score ────────────────────────────────────────────────────────
  -- Both PCM and PCB have a maximum of 200 marks:
  --   PCM: 50 Phy (1m) + 50 Chem (1m) + 50 Math (2m) = 200
  --   PCB: 50 Phy (1m) + 50 Chem (1m) + 100 Bio (1m) = 200
  v_max_score := 200;
  v_clamped := GREATEST(0, LEAST(p_score, v_max_score));

  -- ── 2. Duplicate check via hash insert (GLOBAL — across all shifts) ───────
  INSERT INTO submission_hashes (hash, stream, attempt, shift, ip_hash)
  VALUES (p_hash, p_stream, p_attempt, p_shift, v_ip_hash)
  ON CONFLICT (hash) DO NOTHING;

  v_inserted := FOUND;

  IF NOT v_inserted THEN
    -- Duplicate: still return rank info from current stats
    SELECT score_counts, count
      INTO v_sc, v_shift_count
      FROM shift_stats
     WHERE stream = p_stream AND attempt = p_attempt AND shift = p_shift;

    IF v_sc IS NOT NULL THEN
      SELECT COALESCE(SUM((v)::bigint), 0) INTO v_rank_above
        FROM jsonb_each_text(v_sc) AS t(k, v)
       WHERE (k)::integer > v_clamped;
    END IF;

    RETURN jsonb_build_object(
      'duplicate',   true,
      'rank_above',  COALESCE(v_rank_above, 0),
      'shift_count', COALESCE(v_shift_count, 0)
    );
  END IF;

  -- ── 2.5. LEARNING PHASE (Upsert Signature Vote) ───────────────────────────
  -- We only increment the signature vote if the submission is NOT a duplicate.
  -- This prevents a single person from spamming uploads to artificially lock a shift.
  IF p_signature IS NOT NULL AND length(p_signature) > 0 THEN
    INSERT INTO shift_signatures (stream, attempt, shift, signature, votes)
    VALUES (p_stream, p_attempt, p_shift, p_signature, 1)
    ON CONFLICT (stream, attempt, shift, signature)
    DO UPDATE SET votes = shift_signatures.votes + 1;
  END IF;

  -- ── 3. Upsert shift_stats ────────────────────────────────────────────────
  --    score_counts: increment the key for this score
  --    subject_sums: merge p_subjects, summing overlapping keys

  INSERT INTO shift_stats (stream, attempt, shift, count, total_score, highest, lowest, score_counts, subject_sums, updated_at)
  VALUES (
    p_stream,
    p_attempt,
    p_shift,
    1,
    v_clamped,
    v_clamped::smallint,
    v_clamped::smallint,
    jsonb_build_object(v_clamped::text, 1),
    COALESCE(p_subjects, '{}'),
    now()
  )
  ON CONFLICT (stream, attempt, shift) DO UPDATE SET
    count       = shift_stats.count + 1,
    total_score = shift_stats.total_score + v_clamped,
    highest     = GREATEST(shift_stats.highest, v_clamped::smallint),
    lowest      = LEAST(shift_stats.lowest, v_clamped::smallint),
    score_counts = (
      CASE
        WHEN shift_stats.score_counts ? (v_clamped::text)
        THEN jsonb_set(
               shift_stats.score_counts,
               ARRAY[v_clamped::text],
               to_jsonb( (shift_stats.score_counts ->> (v_clamped::text))::bigint + 1 )
             )
        ELSE shift_stats.score_counts || jsonb_build_object(v_clamped::text, 1)
      END
    ),
    subject_sums = (
      SELECT COALESCE(jsonb_object_agg(k, v), '{}')
        FROM (
          SELECT k, SUM(v) AS v
            FROM (
              SELECT k, (v)::numeric AS v FROM jsonb_each_text(shift_stats.subject_sums) AS t(k, v)
              UNION ALL
              SELECT k, (v)::numeric AS v FROM jsonb_each_text(COALESCE(p_subjects, '{}')) AS t(k, v)
            ) AS combined
           GROUP BY k
        ) AS merged
    ),
    updated_at  = now();

  -- ── 4 & 5. Increment summary counters ─────────────────────────────────────
  UPDATE submission_summary SET value = value + 1 WHERE key = 'total';
  UPDATE submission_summary SET value = value + 1 WHERE key = p_stream;

  -- ── 6. Read back updated stats and compute rank ───────────────────────────
  SELECT score_counts, count
    INTO v_sc, v_shift_count
    FROM shift_stats
   WHERE stream = p_stream AND attempt = p_attempt AND shift = p_shift;

  IF v_sc IS NOT NULL THEN
    SELECT COALESCE(SUM((v)::bigint), 0) INTO v_rank_above
      FROM jsonb_each_text(v_sc) AS t(k, v)
     WHERE (k)::integer > v_clamped;
  END IF;

  -- ── 7. Return result ──────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'duplicate',   false,
    'rank_above',  COALESCE(v_rank_above, 0),
    'shift_count', COALESCE(v_shift_count, 0)
  );
END;
$$;
