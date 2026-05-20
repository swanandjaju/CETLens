// ── CETLens — Supabase-backed analytics ──────────────────────────────────────

// ── HTML escape utility (XSS prevention) ─────────────────────────────────────
// All database-sourced values rendered via innerHTML MUST be escaped with this.
function _escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── In-memory read cache ──────────────────────────────────────────────────────
// Prevents repeat Firebase reads when analysis / community screens are reopened.
// Keys are invalidated automatically after TTL, or explicitly after a new write.

const _fbCache = {};
const _CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function _cacheGet(key) {
  const entry = _fbCache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > _CACHE_TTL_MS) { delete _fbCache[key]; return null; }
  return entry.val;
}

function _cacheSet(key, val) {
  _fbCache[key] = { val, ts: Date.now() };
}

function _cacheInvalidate(prefix) {
  Object.keys(_fbCache).forEach(k => { if (k.startsWith(prefix)) delete _fbCache[k]; });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text:   style.getPropertyValue('--text').trim()        || '#2d3436',
    muted:  style.getPropertyValue('--pewter').trim()      || '#4a5568',
    border: style.getPropertyValue('--border').trim()      || 'rgba(0,0,0,.08)',
    bg:     style.getPropertyValue('--charcoal').trim()    || '#f0f2f5',
    accent: style.getPropertyValue('--accent').trim()      || '#ff4757',
  };
}

function baseChartOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: colors.muted, font: { size: 11 } } },
      tooltip: { backgroundColor: colors.bg, titleColor: colors.text, bodyColor: colors.muted, borderColor: colors.border, borderWidth: 1 }
    },
    scales: {
      x: { ticks: { color: colors.muted, font: { size: 10 } }, grid: { color: colors.border } },
      y: { ticks: { color: colors.muted, font: { size: 10 } }, grid: { color: colors.border } }
    }
  };
}

function drawArcGauge(svgEl, fillEl, ratio) {
  const cx = 100, cy = 110, r = 80;
  const ptAt = a => ({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) });
  const trackStart = ptAt(Math.PI), trackEnd = ptAt(0);
  const trackD = `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${trackEnd.x} ${trackEnd.y}`;
  svgEl.querySelector('.arc-track').setAttribute('d', trackD);
  const clampedRatio = Math.min(Math.max(ratio, 0), 1);
  const fillAngle = Math.PI - clampedRatio * Math.PI;
  const fillEnd = ptAt(fillAngle);
  const fillD = clampedRatio > 0
    ? `M ${trackStart.x} ${trackStart.y} A ${r} ${r} 0 0 1 ${fillEnd.x} ${fillEnd.y}` : '';
  fillEl.setAttribute('d', fillD);
}

function statsPath(stream, attempt, shift) {
  return `stats/${stream}/${attempt}/${shift}`;
}

function scoreLimitForStream(stream) {
  // Both PCM and PCB have 200 max marks
  return 200;
}

function normalizeScore(score, stream) {
  const max = scoreLimitForStream(stream);
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.round(n), 0), max);
}

function incrementAggregate(current, payload) {
  const score = normalizeScore(payload.score, payload.stream);
  const next = current || {};
  next.count = (next.count || 0) + 1;
  next.sum = (next.sum || 0) + score;
  next.highest = Math.max(next.highest === undefined ? -Infinity : next.highest, score);
  next.min = Math.min(next.min === undefined ? Infinity : next.min, score);
  next.scoreCounts = next.scoreCounts || {};
  next.scoreCounts[score] = (next.scoreCounts[score] || 0) + 1;
  next.subjectSums = next.subjectSums || {};
  Object.entries(payload.subjects || {}).forEach(([subject, value]) => {
    const n = Number(value) || 0;
    next.subjectSums[subject] = (next.subjectSums[subject] || 0) + n;
  });
  next.updatedAt = Date.now();
  return next;
}

function countScores(scoreCounts, predicate) {
  return Object.entries(scoreCounts || {}).reduce((total, [score, count]) => {
    const s = Number(score);
    return predicate(s) ? total + (Number(count) || 0) : total;
  }, 0);
}

function expandScoreCounts(scoreCounts) {
  const scores = [];
  Object.entries(scoreCounts || {}).forEach(([score, count]) => {
    const n = Number(count) || 0;
    for (let i = 0; i < n; i++) scores.push(Number(score));
  });
  return scores;
}

function buildShiftMapFromStats(statsByShift) {
  const shiftMap = {};
  Object.entries(statsByShift || {}).forEach(([shiftName, stat]) => {
    shiftMap[shiftName] = {
      scores: expandScoreCounts(stat.scoreCounts),
      scoreCounts: stat.scoreCounts || {},
      subjectSums: stat.subjectSums || {},
      count: stat.count || 0,
      sum: stat.sum || 0,
      highest: stat.highest === undefined ? -Infinity : stat.highest,
      min: stat.min === undefined ? null : stat.min
    };
  });
  return shiftMap;
}

function rawEntriesFromStats(statsByShift, stream, attempt, summary) {
  const raw = {};
  let id = 0;
  Object.entries(statsByShift || {}).forEach(([shift, stat]) => {
    let attachedSubjectSums = false;
    Object.entries(stat.scoreCounts || {}).forEach(([score, count]) => {
      const n = Number(count) || 0;
      for (let i = 0; i < n; i++) {
        raw[`stat_${id++}`] = {
          stream,
          attempt,
          shift,
          score: Number(score),
          subjects: attachedSubjectSums ? undefined : (stat.subjectSums || {})
        };
        attachedSubjectSums = true;
      }
    });
  });
  window._analysisSummary = summary || null;
  return raw;
}

// Fetches aggregated stats for one stream/attempt from Supabase.
// Returns reconstructed raw entries for compatibility with the analysis renderer.
// Results are cached for _CACHE_TTL_MS to avoid redundant reads on re-open.
function fetchAnalysisSupabase(stream, attempt) {
  const cacheKey = `analysisRaw:${stream}:${attempt}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== null) {
    if (cached.statsByShift) {
      return Promise.resolve(rawEntriesFromStats(cached.statsByShift, stream, attempt, cached.summary));
    }
    return Promise.resolve(null);
  }

  const sb = window._supabaseClient;
  if (!sb) return Promise.resolve(null);

  return Promise.all([
    sb.from('shift_stats').select('*').eq('stream', stream).eq('attempt', attempt),
    sb.from('submission_summary').select('*')
  ]).then(([statsRes, summaryRes]) => {
    if (statsRes.error) { console.error('Supabase stats error:', statsRes.error); return null; }
    if (summaryRes.error) { console.error('Supabase summary error:', summaryRes.error); return null; }

    // Reshape rows into { shiftName: { count, sum, highest, min, scoreCounts, subjectSums } }
    const statsByShift = {};
    (statsRes.data || []).forEach(row => {
      statsByShift[row.shift] = {
        count: row.count,
        sum: Number(row.total_score),
        highest: row.highest,
        min: row.lowest,
        scoreCounts: row.score_counts || {},
        subjectSums: row.subject_sums || {}
      };
    });

    // Reshape summary rows into { total, streams: { PCM, PCB } }
    const summary = { total: 0, streams: {} };
    (summaryRes.data || []).forEach(row => {
      if (row.key === 'total') summary.total = Number(row.value);
      else summary.streams[row.key] = Number(row.value);
    });

    _cacheSet(cacheKey, { statsByShift, summary });
    if (Object.keys(statsByShift).length > 0) {
      return rawEntriesFromStats(statsByShift, stream, attempt, summary);
    }
    return null;
  });
}

function renderNoAnalysisData() {
  document.getElementById('analysisLoading').style.display = 'none';
  document.getElementById('analysisContent').innerHTML =
    '<p style="padding:3rem;text-align:center;color:var(--pewter)">No data yet — be the first to submit!</p>';
  document.getElementById('analysisContent').style.display = 'block';
}

// ── hash helper for duplicate prevention ──────────────────────────────────────

async function generateAnswerHash(qs) {
  // Concatenate all questionId + candidateOptId pairs in order
  const raw = qs.map(q => (q.qid || q.id) + ':' + (q.candidateOptId || '0')).join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── save submission ───────────────────────────────────────────────────────────
// Optimized write path (3 Firebase ops instead of 5):
//   1. Read  — hash check (duplicate prevention)
//   2. Write — stats aggregate transaction (concurrent-safe)
//   3. Write — multi-path update: summary counters + hash record (1 round-trip)
//
// The `submissions` collection write has been removed. All analytics rely on
// the aggregated `stats` node, so raw submissions were redundant storage.

async function saveSubmissionToSupabase(qs, st, filename) {
  if (window._isOldSheet) return;
  const sb = window._supabaseClient;
  if (!sb) return;

  const p_stream  = typeof examMode        !== 'undefined' ? examMode        : 'PCM';
  const p_attempt = typeof selectedAttempt !== 'undefined' ? selectedAttempt : '';
  const p_shift   = typeof selectedShift   !== 'undefined' ? selectedShift   : '';
  const p_score   = st.earned;
  const p_subjects = st.subStats
    ? st.subStats.reduce((acc, sub) => { acc[sub.s] = sub.e; return acc; }, {})
    : {};

  try {
    const p_hash = await generateAnswerHash(qs);



    const { data, error } = await sb.rpc('record_submission', {
      p_stream,
      p_attempt,
      p_shift,
      p_score,
      p_subjects,
      p_hash
    });

    if (error) { console.error('Supabase RPC error:', error); return; }



    // Check for application-level errors returned by the RPC
    if (data && data.error) {
      console.error('Submission rejected by server:', data.error);
      return;
    }

    if (data.duplicate) {
      console.log('Score already recorded (duplicate detected).');
    } else {
      console.log('Score saved!');
    }

    // Invalidate stale caches
    _cacheInvalidate(`analysisRaw:${p_stream}:${p_attempt}`);
    _cacheInvalidate('community');

    // Render brief strip directly from RPC result — no second network fetch
    const clamped = normalizeScore(p_score, p_stream);
    const same = 0; // RPC doesn't return this; brief strip doesn't critically need it
    // Re-fetch the shift stats for accurate rendering (sum, highest needed)
    const { data: rows } = await sb.from('shift_stats').select('*')
      .eq('stream', p_stream).eq('attempt', p_attempt).eq('shift', p_shift);
    const row = rows && rows[0];
    if (row && row.count) {
      const above = countScores(row.score_counts, s => s > clamped);
      const sameCount = countScores(row.score_counts, s => s === clamped);
      renderBriefStrip(p_stream, p_attempt, p_shift, p_score, st.subStats || [],
        row.count, Number(row.total_score), row.highest, above, sameCount);
    }
  } catch (err) {
    console.error('Supabase save error:', err);
  }
}

// Backward-compatible alias — script.js calls saveSubmissionToFirebase()
const saveSubmissionToFirebase = saveSubmissionToSupabase;

// ── BRIEF STRIP (dashboard) ───────────────────────────────────────────────────
// Reads only the single shift's aggregated stat node — no fallback to the full
// submissions collection (which could be thousands of records at scale).

function fetchAndRenderBriefStrip(stream, attempt, shift, userScore, userSubStats) {
  const sb = window._supabaseClient;
  if (!sb) return;
  return sb.from('shift_stats').select('*')
    .eq('stream', stream).eq('attempt', attempt).eq('shift', shift)
    .then(({ data, error }) => {
      if (error || !data || data.length === 0) return;
      const stat = data[0];
      if (!stat || !stat.count) return;
      const above = countScores(stat.score_counts, score => score > userScore);
      const same  = countScores(stat.score_counts, score => score === userScore);
      renderBriefStrip(stream, attempt, shift, userScore, userSubStats,
        stat.count, Number(stat.total_score), stat.highest, above, same);
    }).catch(err => console.error('Brief strip fetch error:', err));
}

function renderBriefStrip(stream, attempt, shift, userScore, userSubStats, total, sum, highest, above, same) {
  if (total === 0) return;
  const avg = (sum / total).toFixed(1);
  const pct = total > 1 ? (((total - above) / total) * 100).toFixed(1) : 100;

  const strip = document.getElementById('liveStatsBrief');
  if (!strip) return;
  strip.style.display = '';
  strip.innerHTML = `
    <div class="live-brief-strip">
      <div class="live-brief-strip__led">
        <span class="led led--green led--sm"><span class="led__dot"></span><span class="led__label">Live</span></span>
      </div>
      <div class="live-brief-strip__stats">
        <div class="live-brief-stat">
          <span class="live-brief-stat__val accent">#${above + 1}</span>
          <span class="live-brief-stat__lbl">Shift Rank</span>
        </div>
        <div class="live-brief-stat">
          <span class="live-brief-stat__val">${avg}</span>
          <span class="live-brief-stat__lbl">Shift Average</span>
        </div>
        <div class="live-brief-stat">
          <span class="live-brief-stat__val purple">${highest === -Infinity ? '—' : highest}</span>
          <span class="live-brief-stat__lbl">Shift Highest</span>
        </div>
        <div class="live-brief-stat">
          <span class="live-brief-stat__val green">${above}</span>
          <span class="live-brief-stat__lbl">Ahead of You</span>
        </div>
        <div class="live-brief-stat">
          <span class="live-brief-stat__val">${total}</span>
          <span class="live-brief-stat__lbl">Total in Shift</span>
        </div>
      </div>
      <div class="live-brief-strip__action">
        <button class="btn-ghost" onclick="openAnalysisScreen()">View Full Analysis →</button>
      </div>
    </div>`;

  window._lastFirebaseData = { stream, attempt, shift, userScore, userSubStats };
}

// ── FULL ANALYSIS SCREEN ──────────────────────────────────────────────────────

function fetchFullAnalysis() {
  const sb = window._supabaseClient;
  if (!sb) {
    document.getElementById('analysisLoading').style.display = 'none';
    return;
  }
  const ctx = window._lastFirebaseData || {};
  const stream    = ctx.stream    || (typeof examMode        !== 'undefined' ? examMode        : 'PCM');
  const attempt   = ctx.attempt   || (typeof selectedAttempt !== 'undefined' ? selectedAttempt : '');
  const shift     = ctx.shift     || (typeof selectedShift   !== 'undefined' ? selectedShift   : '');
  const userScore = ctx.userScore !== undefined ? ctx.userScore : 0;
  const userSubStats = ctx.userSubStats || [];

  fetchAnalysisSupabase(stream, attempt).then(raw => {
    if (!raw) {
      document.getElementById('analysisLoading').style.display = 'none';
      document.getElementById('analysisContent').innerHTML = '<p style="padding:3rem;text-align:center;color:var(--pewter)">No data yet — be the first to submit!</p>';
      document.getElementById('analysisContent').style.display = 'block';
      return;
    }

    // ── aggregate ─────────────────────────────────────────────────────────────
    // per-shift data (same stream & attempt)
    const shiftMap = {}; // { shiftName: { scores:[], subjectSums:{}, count, highest } }
    // global
    let totalAllStreams = 0, pcmCount = 0, pcbCount = 0;

    for (const key in raw) {
      const e = raw[key];
      totalAllStreams++;
      if (e.stream === 'PCM') pcmCount++; else pcbCount++;

      if (e.stream !== stream || e.attempt !== attempt) continue;

      if (!shiftMap[e.shift]) shiftMap[e.shift] = { scores: [], subjectSums: {}, count: 0, highest: -Infinity };
      const sd = shiftMap[e.shift];
      sd.scores.push(e.score);
      sd.count++;
      if (e.score > sd.highest) sd.highest = e.score;
      if (e.subjects) {
        for (const subj in e.subjects) {
          if (!sd.subjectSums[subj]) sd.subjectSums[subj] = 0;
          sd.subjectSums[subj] += e.subjects[subj];
        }
      }
    }

    if (window._analysisSummary) {
      totalAllStreams = window._analysisSummary.total || totalAllStreams;
      pcmCount = (window._analysisSummary.streams && window._analysisSummary.streams.PCM) || pcmCount;
      pcbCount = (window._analysisSummary.streams && window._analysisSummary.streams.PCB) || pcbCount;
    }

    // user's shift data
    const myShift = shiftMap[shift] || { scores: [], subjectSums: {}, count: 0, highest: 0 };
    const myScores = myShift.scores;
    const myCount  = myShift.count;
    const myAvg    = myCount > 0 ? (myShift.scores.reduce((a, b) => a + b, 0) / myCount) : 0;
    const myHighest = myShift.highest === -Infinity ? 0 : myShift.highest;

    const above = myScores.filter(s => s > userScore).length;
    const same  = myScores.filter(s => s === userScore).length;
    const below = myScores.filter(s => s < userScore).length;
    const pct   = myCount > 1 ? (((myCount - above) / myCount) * 100).toFixed(1) : 100;

    // median
    const sorted = [...myScores].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? (sorted.length % 2 === 0
          ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
          : sorted[Math.floor(sorted.length / 2)])
      : '—';

    // subject avgs for user's shift
    const shiftSubjectAvgs = {};
    for (const subj in myShift.subjectSums) {
      shiftSubjectAvgs[subj] = myCount > 0 ? (myShift.subjectSums[subj] / myCount).toFixed(1) : 0;
    }

    // score distribution (buckets of 20)
    const buckets = {};
    const maxScore = 200;
    for (let i = 0; i <= maxScore; i += 20) buckets[i] = 0;
    myScores.forEach(s => {
      const b = Math.floor(s / 20) * 20;
      if (buckets[b] !== undefined) buckets[b]++;
    });

    // ── render stat elements ───────────────────────────────────────────────────
    document.getElementById('analysisTotalBadge').textContent = `${totalAllStreams} total submissions`;
    document.getElementById('analysisTotalAll').textContent   = totalAllStreams;
    
    document.getElementById('analysisShiftRankVal').textContent = `#${above + 1}`;
    document.getElementById('analysisShiftRankTotal').textContent = `OUT OF ${myCount} STUDENTS`;
    const topPct = myCount > 0 ? Math.max(1, Math.ceil(((above + 1) / myCount) * 100)) : 100;
    document.getElementById('analysisShiftRankSub').textContent = `You scored higher than ${below} students (Top ${topPct}%).`;
    
    document.getElementById('analysisAhead').textContent    = above;
    document.getElementById('analysisSame').textContent     = same;
    document.getElementById('analysisBelow').textContent    = below;
    document.getElementById('analysisShiftAvg').textContent = myAvg.toFixed(1);
    document.getElementById('analysisShiftHighest').textContent = myHighest;
    document.getElementById('analysisShiftCount').textContent   = myCount;
    document.getElementById('analysisMedian').textContent = median;
    document.getElementById('analysisMean').textContent   = myAvg.toFixed(1);

    // ── Charts ─────────────────────────────────────────────────────────────────
    const colors = getChartColors();

    // 1. Score compare (you vs avg vs highest)
    const compareCtx = document.getElementById('scoreCompareChart');
    if (compareCtx) {
      _analysisCharts['scoreCompare'] = new Chart(compareCtx, {
        type: 'bar',
        data: {
          labels: ['Your Score', 'Shift Average', 'Shift Highest'],
          datasets: [{
            data: [userScore, parseFloat(myAvg.toFixed(1)), myHighest],
            backgroundColor: [colors.accent, '#60a5fa', '#c084fc'],
            borderRadius: 6, borderSkipped: false
          }]
        },
        options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
      });
    }

    // 2. Radar: you vs shift avg (subjects)
    const subjs = Object.keys(shiftSubjectAvgs);
    const userSubMap = {};
    userSubStats.forEach(s => { userSubMap[s.s] = s.e; });
    if (subjs.length > 0) {
      const radarCtx = document.getElementById('subjectRadarChart');
      if (radarCtx) {
        _analysisCharts['radar'] = new Chart(radarCtx, {
          type: 'radar',
          data: {
            labels: subjs,
            datasets: [
              { label: 'You', data: subjs.map(s => userSubMap[s] || 0), backgroundColor: 'rgba(255,71,87,.2)', borderColor: colors.accent, pointBackgroundColor: colors.accent, borderWidth: 2 },
              { label: 'Shift Avg', data: subjs.map(s => parseFloat(shiftSubjectAvgs[s])), backgroundColor: 'rgba(96,165,250,.15)', borderColor: '#60a5fa', pointBackgroundColor: '#60a5fa', borderWidth: 2 }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: colors.muted, font: { size: 11 } } }, tooltip: { backgroundColor: colors.bg, titleColor: colors.text, bodyColor: colors.muted } },
            scales: { r: { ticks: { color: colors.muted, backdropColor: 'transparent', font: { size: 10 } }, grid: { color: colors.border }, pointLabels: { color: colors.text, font: { size: 11 } } } }
          }
        });
      }

      // Subject compare rows
      const SC = { Physics: '#00d4ff', Chemistry: '#c084fc', Mathematics: colors.accent, Biology: '#00d4ff' };
      const rowsEl = document.getElementById('subjectCompareRows');
      if (rowsEl) {
        const subjMaxMap = { Physics: 50, Chemistry: 50, Mathematics: stream === 'PCM' ? 100 : 50, Biology: stream === 'PCB' ? 100 : 50 };
        rowsEl.innerHTML = subjs.map(s => {
          const youVal  = userSubMap[s] || 0;
          const avgVal  = parseFloat(shiftSubjectAvgs[s]);
          const maxVal  = subjMaxMap[s] || 50;
          const youPct  = Math.min(youVal / maxVal * 100, 100).toFixed(0);
          const avgPct  = Math.min(avgVal / maxVal * 100, 100).toFixed(0);
          const col = SC[s] || colors.accent;
          return `
            <div class="subject-compare-row">
              <div class="subject-compare-row__header">
                <span class="subject-compare-row__name">${_escHtml(s)}</span>
                <span class="subject-compare-row__vals">You: <strong style="color:${col}">${youVal}</strong> &nbsp;·&nbsp; Avg: <strong>${avgVal}</strong> &nbsp;·&nbsp; Max: ${maxVal}</span>
              </div>
              <div class="subject-compare-track">
                <div class="subject-compare-bar subject-compare-bar--avg" style="width:${avgPct}%;background:#60a5fa"></div>
                <div class="subject-compare-bar subject-compare-bar--you" style="width:${youPct}%;background:${col};opacity:.85"></div>
              </div>
            </div>`;
        }).join('');
      }
    }

    // 3. Score histogram
    const histCtx = document.getElementById('scoreHistogramChart');
    if (histCtx) {
      const bucketKeys   = Object.keys(buckets).map(Number).sort((a, b) => a - b);
      const bucketLabels = bucketKeys.map(k => `${k}–${k + 19}`);
      const bucketVals   = bucketKeys.map(k => buckets[k]);
      const userBucket   = Math.floor(userScore / 20) * 20;
      const bgColors = bucketKeys.map(k => k === userBucket ? colors.accent : 'rgba(96,165,250,.5)');

      _analysisCharts['histogram'] = new Chart(histCtx, {
        type: 'bar',
        data: { labels: bucketLabels, datasets: [{ label: 'Students', data: bucketVals, backgroundColor: bgColors, borderRadius: 4 }] },
        options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false }, tooltip: { callbacks: { afterTitle: items => items[0].dataIndex === bucketKeys.indexOf(userBucket) ? ['← Your score range'] : [] } } } }
      });

      // distribution stats
      const distEl = document.getElementById('distributionStats');
      if (distEl && sorted.length > 0) {
        const modeScore = myScores.reduce((a, b, _, arr) =>
          arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b, myScores[0]);
        distEl.innerHTML = [
          ['Mean', myAvg.toFixed(1)], ['Median', median], ['Mode', modeScore],
          ['Min', sorted[0]], ['Max', sorted[sorted.length - 1]], ['Participants', myCount]
        ].map(([l, v]) => `<div class="dist-stat"><div class="dist-stat__val">${v}</div><div class="dist-stat__lbl">${l}</div></div>`).join('');
      }
    }

    // 4. Shift avg bar chart (all shifts)
    const shiftNames = Object.keys(shiftMap).sort();
    const shiftAvgs  = shiftNames.map(s => parseFloat((shiftMap[s].scores.reduce((a, b) => a + b, 0) / shiftMap[s].count).toFixed(1)));
    const shiftHighs = shiftNames.map(s => shiftMap[s].highest === -Infinity ? 0 : shiftMap[s].highest);
    const shiftCounts = shiftNames.map(s => shiftMap[s].count);
    const shiftBgColors = shiftNames.map(s => s === shift ? colors.accent : 'rgba(96,165,250,.55)');

    const shiftAvgCtx = document.getElementById('shiftAvgChart');
    if (shiftAvgCtx) {
      _analysisCharts['shiftAvg'] = new Chart(shiftAvgCtx, {
        type: 'bar',
        data: { labels: shiftNames, datasets: [{ label: 'Avg Score', data: shiftAvgs, backgroundColor: shiftBgColors, borderRadius: 6 }] },
        options: { ...baseChartOptions(colors), indexAxis: 'y', plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
      });
    }

    const participantsCtx = document.getElementById('shiftParticipantsChart');
    if (participantsCtx) {
      _analysisCharts['participants'] = new Chart(participantsCtx, {
        type: 'bar',
        data: { labels: shiftNames, datasets: [{ label: 'Students', data: shiftCounts, backgroundColor: shiftBgColors, borderRadius: 4 }] },
        options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
      });
    }

    const highestCtx = document.getElementById('shiftHighestChart');
    if (highestCtx) {
      _analysisCharts['highest'] = new Chart(highestCtx, {
        type: 'bar',
        data: { labels: shiftNames, datasets: [{ label: 'Highest Score', data: shiftHighs, backgroundColor: 'rgba(192,132,252,.6)', borderRadius: 4 }] },
        options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
      });
    }

    // 5. Subject avg per shift (grouped bar)
    const allSubjects = [...new Set(Object.values(shiftMap).flatMap(sd => Object.keys(sd.subjectSums)))];
    const subjectColors = { Physics: '#00d4ff', Chemistry: '#c084fc', Mathematics: colors.accent, Biology: '#22c55e' };
    const shiftSubjectCtx = document.getElementById('shiftSubjectChart');
    if (shiftSubjectCtx && allSubjects.length > 0) {
      _analysisCharts['shiftSubject'] = new Chart(shiftSubjectCtx, {
        type: 'bar',
        data: {
          labels: shiftNames,
          datasets: allSubjects.map(subj => ({
            label: subj,
            data: shiftNames.map(s => {
              const sd = shiftMap[s];
              return sd.subjectSums[subj] ? parseFloat((sd.subjectSums[subj] / sd.count).toFixed(1)) : 0;
            }),
            backgroundColor: (subjectColors[subj] || '#888') + 'cc',
            borderRadius: 3
          }))
        },
        options: { ...baseChartOptions(colors), scales: { x: { stacked: false, ticks: { color: colors.muted, font: { size: 9 } }, grid: { color: colors.border } }, y: { ticks: { color: colors.muted, font: { size: 10 } }, grid: { color: colors.border } } } }
      });
    }

    // 6. Stream donut (PCM vs PCB all submissions)
    const streamCtx = document.getElementById('streamDonutChart');
    if (streamCtx) {
      _analysisCharts['stream'] = new Chart(streamCtx, {
        type: 'doughnut',
        data: {
          labels: ['PCM', 'PCB'],
          datasets: [{ data: [pcmCount, pcbCount], backgroundColor: [colors.accent, '#60a5fa'], borderWidth: 0, hoverOffset: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { labels: { color: colors.muted } }, tooltip: { backgroundColor: colors.bg, titleColor: colors.text, bodyColor: colors.muted } } }
      });
    }

    // 7. Populate shift drill-down selector
    const sel = document.getElementById('analysisShiftSelect');
    if (sel) {
      sel.innerHTML = shiftNames.map(s => `<option value="${_escHtml(s)}" ${s === shift ? 'selected' : ''}>${_escHtml(s)}</option>`).join('');
      window._shiftMapData = shiftMap;
      renderShiftDrillDown(shift || shiftNames[0]);
    }

    // Show content
    document.getElementById('analysisLoading').style.display = 'none';
    document.getElementById('analysisContent').style.display  = 'block';

  }).catch(err => {
    console.error('Full analysis fetch error:', err);
    document.getElementById('analysisLoading').style.display = 'none';
  });
}

// ── Drill-down renderer ───────────────────────────────────────────────────────

function renderShiftDrillDown(shiftName) {
  const container = document.getElementById('shiftDrillDown');
  if (!container || !window._shiftMapData) return;
  const sd = window._shiftMapData[shiftName];
  if (!sd) { container.innerHTML = '<p style="color:var(--pewter);font-size:13px">No data for this shift yet.</p>'; return; }

  const scores = sd.scores || [];
  const count  = sd.count;
  const avg    = count > 0 ? (scores.reduce((a, b) => a + b, 0) / count).toFixed(1) : '—';
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted.length > 0
    ? (sorted.length % 2 === 0
        ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
        : sorted[Math.floor(sorted.length / 2)]) : '—';

  const subjectRows = Object.entries(sd.subjectSums).map(([subj, sum]) => {
    const sAvg = count > 0 ? (sum / count).toFixed(1) : '—';
    const highest = scores.length > 0 ? sd.scores.reduce((best, _, i, arr) => {
      // We don't track per-subject per-student breakdown so just show avg
      return best;
    }, '—') : '—';
    return `
      <div class="drill-subject-row">
        <span class="drill-subject-name">${_escHtml(subj)}</span>
        <span class="drill-subject-val" style="color:var(--text2)">Avg: ${sAvg}</span>
        <span class="drill-subject-val" style="color:var(--pewter)">Total entries: ${count}</span>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="drill-down-grid">
      <div class="drill-cell"><div class="drill-cell__val">${count}</div><div class="drill-cell__lbl">Participants</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${avg}</div><div class="drill-cell__lbl">Average Score</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${sd.highest === -Infinity ? '—' : sd.highest}</div><div class="drill-cell__lbl">Highest Score</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${median}</div><div class="drill-cell__lbl">Median Score</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${sorted[0] !== undefined ? sorted[0] : '—'}</div><div class="drill-cell__lbl">Lowest Score</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${sorted.length > 0 ? (sorted[0] + sorted[sorted.length-1] > 0 ? (sorted.reduce((a,b)=>a+b,0)/sorted.length*100/(sorted[sorted.length-1]||1)).toFixed(0)+'%' : '—') : '—'}</div><div class="drill-cell__lbl">Score Spread</div></div>
    </div>
    ${subjectRows.length > 0 ? `
      <div style="margin-top:1.25rem">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--text2);margin-bottom:.75rem">Subject-wise Averages</div>
        <div class="drill-subject-row" style="font-size:10px;color:var(--pewter);font-weight:700;border-bottom:2px solid var(--border2)">
          <span>Subject</span><span style="text-align:right">Average</span><span style="text-align:right">Participants</span>
        </div>
        ${subjectRows}
      </div>` : ''}`;
}


// ── COMMUNITY FULL-SCREEN ANALYSIS ───────────────────────────────────────────
// Results are cached for _CACHE_TTL_MS. Reopening the screen within the TTL
// window costs zero Firebase reads.

let _communityCharts = {};
let _selectedCommunityStream = 'PCM';  // default stream filter
let _communityPayloadCache = null;     // stores fetched payload for re-render on stream switch

function switchCommunityStream(stream) {
  if (stream !== 'PCM' && stream !== 'PCB') return;
  _selectedCommunityStream = stream;

  // Update button states
  const btnPCM = document.getElementById('commStreamBtnPCM');
  const btnPCB = document.getElementById('commStreamBtnPCB');
  if (btnPCM) btnPCM.classList.toggle('active', stream === 'PCM');
  if (btnPCB) btnPCB.classList.toggle('active', stream === 'PCB');

  // Re-render with cached data if available
  if (_communityPayloadCache) {
    _renderCommunityData(_communityPayloadCache);
  }
}

function fetchCommunityFullAnalysis() {
  const sb = window._supabaseClient;
  if (!sb) {
    const el = document.getElementById('commLoading');
    if (el) el.style.display = 'none';
    return;
  }

  // Serve from cache if available
  const cacheKey = 'community';
  const cached = _cacheGet(cacheKey);
  if (cached) {
    _communityPayloadCache = cached;
    _renderCommunityData(cached);
    return;
  }

  Promise.all([
    sb.from('shift_stats').select('*').eq('attempt', 'Attempt 1'),
    sb.from('submission_summary').select('*')
  ]).then(([statsRes, summaryRes]) => {
    if (statsRes.error) { console.error('Supabase community stats error:', statsRes.error); return; }

    // Separate rows by stream into { shiftName: stat } maps
    const pcmStats = {};
    const pcbStats = {};
    (statsRes.data || []).forEach(row => {
      const obj = {
        count: row.count,
        sum: Number(row.total_score),
        highest: row.highest,
        min: row.lowest,
        scoreCounts: row.score_counts || {},
        subjectSums: row.subject_sums || {}
      };
      if (row.stream === 'PCM') pcmStats[row.shift] = obj;
      else pcbStats[row.shift] = obj;
    });

    // Reshape summary
    const summary = { total: 0, streams: {} };
    (summaryRes.data || []).forEach(row => {
      if (row.key === 'total') summary.total = Number(row.value);
      else summary.streams[row.key] = Number(row.value);
    });

    const payload = { pcmStats, pcbStats, summary };
    _cacheSet(cacheKey, payload);
    _communityPayloadCache = payload;
    _renderCommunityData(payload);
  }).catch(err => {
    console.error('Community analysis fetch error:', err);
    document.getElementById('commLoading').style.display = 'none';
  });
}

// Internal renderer — filters by _selectedCommunityStream
function _renderCommunityData({ pcmStats, pcbStats, summary }) {
  const noDataEl = document.getElementById('commNoData');
  const noDataMsg = document.getElementById('commNoDataMsg');
  const chartSections = document.getElementById('commChartSections');

  // Always destroy old charts first to prevent stale renders
  Object.values(_communityCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  _communityCharts = {};

  if (!pcmStats && !pcbStats) {
    document.getElementById('commLoading').style.display = 'none';
    document.getElementById('commTotalBadge').textContent = '0 submissions';
    if (noDataMsg) noDataMsg.textContent = 'No data yet — be the first to submit!';
    if (noDataEl) noDataEl.style.display = 'block';
    if (chartSections) chartSections.style.display = 'none';
    document.getElementById('commContent').style.display = 'block';
    return;
  }

  // Pick stats for the selected stream only
  const stream = _selectedCommunityStream;
  const activeStats = stream === 'PCM' ? (pcmStats || {}) : (pcbStats || {});
  const activeShiftMap = buildShiftMapFromStats(activeStats);

  // Totals for the selected stream
  let pcmTotal = 0, pcbTotal = 0;
  const pcmShiftMap = buildShiftMapFromStats(pcmStats || {});
  const pcbShiftMap = buildShiftMapFromStats(pcbStats || {});
  Object.values(pcmShiftMap).forEach(s => { pcmTotal += s.count; });
  Object.values(pcbShiftMap).forEach(s => { pcbTotal += s.count; });
  if (summary && summary.streams) {
    pcmTotal = summary.streams.PCM || pcmTotal;
    pcbTotal = summary.streams.PCB || pcbTotal;
  }
  const streamTotal = stream === 'PCM' ? pcmTotal : pcbTotal;

  // Scores for the selected stream only
  let allScores = [];
  Object.values(activeShiftMap).forEach(s => { allScores = allScores.concat(s.scores); });

  // Shift names for the selected stream
  const shiftNames = Object.keys(activeShiftMap).sort();

  if (shiftNames.length === 0) {
    document.getElementById('commLoading').style.display = 'none';
    document.getElementById('commTotalBadge').textContent = `0 ${stream} submissions`;
    if (noDataMsg) noDataMsg.textContent = 'No ' + stream + ' data yet — be the first to submit!';
    if (noDataEl) noDataEl.style.display = 'block';
    if (chartSections) chartSections.style.display = 'none';
    document.getElementById('commContent').style.display = 'block';
    return;
  }

  // Data exists — show chart sections, hide no-data overlay
  if (noDataEl) noDataEl.style.display = 'none';
  if (chartSections) chartSections.style.display = '';


  // Stats
  const sorted = [...allScores].sort((a, b) => a - b);
  const median = sorted.length > 0
    ? (sorted.length % 2 === 0
        ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
        : sorted[Math.floor(sorted.length / 2)])
    : '—';
  const mean = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '—';

  // Badge
  document.getElementById('commTotalBadge').textContent = `${streamTotal} ${stream} submissions`;

  const colors = getChartColors();


  // ── Score Distribution Histogram ──
  const maxBucket = 200;
  const buckets = {};
  for (let i = 0; i <= maxBucket; i += 20) buckets[i] = 0;
  allScores.forEach(s => {
    const b = Math.min(Math.floor(s / 20) * 20, maxBucket - 20);
    if (buckets[b] !== undefined) buckets[b]++;
  });
  const bucketKeys = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  const bucketLabels = bucketKeys.map(k => `${k}\u2013${k + 19}`);
  const bucketVals = bucketKeys.map(k => buckets[k]);

  const histCtx = document.getElementById('comm-histogramChart');
  if (histCtx) {
    _communityCharts.histogram = new Chart(histCtx, {
      type: 'bar',
      data: { labels: bucketLabels, datasets: [{ label: 'Students', data: bucketVals, backgroundColor: stream === 'PCM' ? 'rgba(255,71,87,.5)' : 'rgba(96,165,250,.5)', borderRadius: 4 }] },
      options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
    });
  }

  // Distribution stats
  const distEl = document.getElementById('commDistributionStats');
  if (distEl && sorted.length > 0) {
    const modeScore = allScores.reduce((a, b, _, arr) =>
      arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b, allScores[0]);
    distEl.innerHTML = [
      ['Mean', mean], ['Median', median], ['Mode', modeScore],
      ['Min', sorted[0]], ['Max', sorted[sorted.length - 1]], ['Participants', streamTotal]
    ].map(([l, v]) => `<div class="dist-stat"><div class="dist-stat__val">${v}</div><div class="dist-stat__lbl">${l}</div></div>`).join('');
  }

  // ── Shift Avg Chart ──
  const streamColor = stream === 'PCM' ? 'rgba(255,71,87,.55)' : 'rgba(96,165,250,.55)';
  const shiftAvgs = shiftNames.map(s => {
    const d = activeShiftMap[s];
    return d.count > 0 ? parseFloat((d.scores.reduce((a, b) => a + b, 0) / d.count).toFixed(1)) : 0;
  });
  const shiftAvgCtx = document.getElementById('comm-shiftAvgChart');
  if (shiftAvgCtx) {
    _communityCharts.shiftAvg = new Chart(shiftAvgCtx, {
      type: 'bar',
      data: { labels: shiftNames, datasets: [{ label: 'Avg Score', data: shiftAvgs, backgroundColor: streamColor, borderRadius: 6 }] },
      options: { ...baseChartOptions(colors), indexAxis: 'y', plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
    });
  }

  // ── Participants per Shift ──
  const shiftCounts = shiftNames.map(s => activeShiftMap[s].count);
  const partCtx = document.getElementById('comm-participantsChart');
  if (partCtx) {
    _communityCharts.participants = new Chart(partCtx, {
      type: 'bar',
      data: { labels: shiftNames, datasets: [{ label: 'Students', data: shiftCounts, backgroundColor: 'rgba(192,132,252,.55)', borderRadius: 4 }] },
      options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
    });
  }

  // ── Highest per Shift ──
  const shiftHighs = shiftNames.map(s => activeShiftMap[s].highest === -Infinity ? 0 : activeShiftMap[s].highest);
  const highCtx = document.getElementById('comm-highestChart');
  if (highCtx) {
    _communityCharts.highest = new Chart(highCtx, {
      type: 'bar',
      data: { labels: shiftNames, datasets: [{ label: 'Highest Score', data: shiftHighs, backgroundColor: 'rgba(192,132,252,.6)', borderRadius: 4 }] },
      options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
    });
  }

  // ── Subject Avg per Shift ──
  const allSubjects = [...new Set(Object.values(activeShiftMap).flatMap(sd => Object.keys(sd.subjectSums)))];
  const subjectColors = { Physics: '#00d4ff', Chemistry: '#c084fc', Mathematics: colors.accent, Biology: '#22c55e' };
  const shiftSubjCtx = document.getElementById('comm-shiftSubjectChart');
  if (shiftSubjCtx && allSubjects.length > 0) {
    _communityCharts.shiftSubject = new Chart(shiftSubjCtx, {
      type: 'bar',
      data: {
        labels: shiftNames,
        datasets: allSubjects.map(subj => ({
          label: subj,
          data: shiftNames.map(s => {
            const sd = activeShiftMap[s];
            return sd.subjectSums[subj] ? parseFloat((sd.subjectSums[subj] / sd.count).toFixed(1)) : 0;
          }),
          backgroundColor: (subjectColors[subj] || '#888') + 'cc',
          borderRadius: 3
        }))
      },
      options: { ...baseChartOptions(colors), scales: { x: { stacked: false, ticks: { color: colors.muted, font: { size: 9 } }, grid: { color: colors.border } }, y: { ticks: { color: colors.muted, font: { size: 10 } }, grid: { color: colors.border } } } }
    });
  }

  // ── Stream Donut ──
  const donutCtx = document.getElementById('comm-streamDonutChart');
  if (donutCtx) {
    _communityCharts.stream = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: ['PCM', 'PCB'],
        datasets: [{ data: [pcmTotal, pcbTotal], backgroundColor: [colors.accent, '#60a5fa'], borderWidth: 0, hoverOffset: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { labels: { color: colors.muted } }, tooltip: { backgroundColor: colors.bg, titleColor: colors.text, bodyColor: colors.muted } } }
    });
  }

  // ── Stream Overview Stats ──
  document.getElementById('commTotalAll').textContent = streamTotal;
  document.getElementById('commMedian').textContent = median;
  document.getElementById('commMean').textContent = mean;

  // ── Drill Down Selector ──
  const sel = document.getElementById('commShiftSelect');
  if (sel) {
    sel.innerHTML = shiftNames.map(s => `<option value="${_escHtml(s)}">${_escHtml(s)}</option>`).join('');
    window._commShiftMapData = activeShiftMap;
    renderCommShiftDrillDown(shiftNames[0]);
  }

  // Show content
  document.getElementById('commLoading').style.display = 'none';
  document.getElementById('commContent').style.display = 'block';
}


function renderCommShiftDrillDown(shiftName) {
  const container = document.getElementById('commDrillDown');
  if (!container || !window._commShiftMapData) return;
  const sd = window._commShiftMapData[shiftName];
  if (!sd) { container.innerHTML = '<p style="color:var(--pewter);font-size:13px">No data for this shift yet.</p>'; return; }

  const scores = sd.scores || [];
  const count  = sd.count;
  const avg    = count > 0 ? (scores.reduce((a, b) => a + b, 0) / count).toFixed(1) : '—';
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted.length > 0
    ? (sorted.length % 2 === 0
        ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
        : sorted[Math.floor(sorted.length / 2)]) : '—';

  const subjectRows = Object.entries(sd.subjectSums).map(([subj, sum]) => {
    const sAvg = count > 0 ? (sum / count).toFixed(1) : '—';
    return `<div class="drill-subject-row">
        <span class="drill-subject-name">${_escHtml(subj)}</span>
        <span class="drill-subject-val" style="color:var(--text2)">Avg: ${sAvg}</span>
        <span class="drill-subject-val" style="color:var(--pewter)">Total entries: ${count}</span>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="drill-down-grid">
      <div class="drill-cell"><div class="drill-cell__val">${count}</div><div class="drill-cell__lbl">Participants</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${avg}</div><div class="drill-cell__lbl">Average Score</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${sd.highest === -Infinity ? '—' : sd.highest}</div><div class="drill-cell__lbl">Highest Score</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${median}</div><div class="drill-cell__lbl">Median Score</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${sorted[0] !== undefined ? sorted[0] : '—'}</div><div class="drill-cell__lbl">Lowest Score</div></div>
      <div class="drill-cell"><div class="drill-cell__val">${sorted.length > 0 ? (sorted[sorted.length-1] - sorted[0]) : '—'}</div><div class="drill-cell__lbl">Score Range</div></div>
    </div>
    ${subjectRows.length > 0 ? `
      <div style="margin-top:1.25rem">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--text2);margin-bottom:.75rem">Subject-wise Averages</div>
        <div class="drill-subject-row" style="font-size:10px;color:var(--pewter);font-weight:700;border-bottom:2px solid var(--border2)">
          <span>Subject</span><span style="text-align:right">Average</span><span style="text-align:right">Participants</span>
        </div>
        ${subjectRows}
      </div>` : ''}`;
}
