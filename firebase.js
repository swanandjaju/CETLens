const firebaseConfig = {
  apiKey: "AIzaSyAJcMR2h0koopwyxw81ybyGqkq4KPWlLWI",
  authDomain: "cetlens.firebaseapp.com",
  databaseURL: "https://cetlens-default-rtdb.firebaseio.com",
  projectId: "cetlens",
  storageBucket: "cetlens.firebasestorage.app",
  messagingSenderId: "531158222764",
  appId: "1:531158222764:web:912956a9796b9a3fa11c09",
  measurementId: "G-QE27HLWH4Y"
};

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}

// ── In-memory read cache ──────────────────────────────────────────────────────
// Prevents repeat Firebase reads when analysis / community screens are reopened.
// Keys are invalidated automatically after TTL, or explicitly after a new write.

const _fbCache = {};
const _CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  return stream === 'PCB' ? 150 : 200;
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

// Fetches aggregated stats for one stream/attempt. Returns reconstructed raw
// entries for compatibility with the analysis renderer.
// Results are cached for _CACHE_TTL_MS to avoid redundant reads on re-open.
function fetchAnalysisRaw(db, stream, attempt) {
  const cacheKey = `analysisRaw:${stream}:${attempt}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== null) {
    // Reconstruct raw from cached data (no Firebase read needed)
    if (cached.statsByShift) {
      return Promise.resolve(rawEntriesFromStats(cached.statsByShift, stream, attempt, cached.summary));
    }
    return Promise.resolve(null);
  }

  return Promise.all([
    db.ref(`stats/${stream}/${attempt}`).once('value'),
    db.ref('summary').once('value')
  ]).then(([statsSnapshot, summarySnapshot]) => {
    const statsByShift = statsSnapshot.val();
    const summary = summarySnapshot.val();
    _cacheSet(cacheKey, { statsByShift, summary });
    if (statsByShift) return rawEntriesFromStats(statsByShift, stream, attempt, summary);
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

async function saveSubmissionToFirebase(qs, st, filename) {
  if (typeof firebase === 'undefined') return;
  const db = firebase.database();
  const payload = {
    attempt: typeof selectedAttempt !== 'undefined' ? selectedAttempt : '',
    shift:   typeof selectedShift   !== 'undefined' ? selectedShift   : '',
    stream:  typeof examMode        !== 'undefined' ? examMode        : 'PCM',
    score:   st.earned,
    subjects: st.subStats ? st.subStats.reduce((acc, sub) => { acc[sub.s] = sub.e; return acc; }, {}) : {},
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  try {
    // 1. Duplicate check (1 read)
    const hash = await generateAnswerHash(qs);
    const hashPath = `hashes/${payload.stream}/${payload.shift}/${hash}`;

    const hashSnapshot = await db.ref(hashPath).once('value');
    if (hashSnapshot.exists()) {
      // Duplicate detected — skip write, proceed to render
      console.log('Score already recorded (duplicate detected).');
      fetchAndRenderBriefStrip(payload.stream, payload.attempt, payload.shift, payload.score, st.subStats || []);
      return;
    }

    // 2. Stats aggregate transaction (1 write — handles concurrent submissions safely)
    await db.ref(statsPath(payload.stream, payload.attempt, payload.shift))
      .transaction(current => incrementAggregate(current, {
        ...payload,
        score: normalizeScore(payload.score, payload.stream)
      }));

    // 3. Combined write: summary counters + hash record (1 write instead of 2)
    const updates = {};
    updates['summary/total'] = firebase.database.ServerValue.increment(1);
    updates[`summary/streams/${payload.stream}`] = firebase.database.ServerValue.increment(1);
    updates[hashPath] = { timestamp: firebase.database.ServerValue.TIMESTAMP };
    await db.ref().update(updates);

    // Invalidate stale caches so next analysis read fetches fresh data
    _cacheInvalidate(`analysisRaw:${payload.stream}:${payload.attempt}`);
    _cacheInvalidate('community');

    console.log('Score saved!');
    fetchAndRenderBriefStrip(payload.stream, payload.attempt, payload.shift, payload.score, st.subStats || []);
  } catch (err) {
    console.error('Firebase save error:', err);
  }
}

// ── BRIEF STRIP (dashboard) ───────────────────────────────────────────────────
// Reads only the single shift's aggregated stat node — no fallback to the full
// submissions collection (which could be thousands of records at scale).

function fetchAndRenderBriefStrip(stream, attempt, shift, userScore, userSubStats) {
  if (typeof firebase === 'undefined') return;
  const db = firebase.database();
  return db.ref(statsPath(stream, attempt, shift)).once('value').then(snapshot => {
    const stat = snapshot.val();
    if (stat && stat.count) {
      const above = countScores(stat.scoreCounts, score => score > userScore);
      const same  = countScores(stat.scoreCounts, score => score === userScore);
      renderBriefStrip(stream, attempt, shift, userScore, userSubStats, stat.count, stat.sum || 0, stat.highest, above, same);
    }
    // If no stats yet (no one has submitted), strip simply stays hidden.
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
          <span class="live-brief-stat__val accent">${pct}%</span>
          <span class="live-brief-stat__lbl">Your Percentile</span>
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
  if (typeof firebase === 'undefined') {
    document.getElementById('analysisLoading').style.display = 'none';
    return;
  }
  const ctx = window._lastFirebaseData || {};
  const stream    = ctx.stream    || (typeof examMode        !== 'undefined' ? examMode        : 'PCM');
  const attempt   = ctx.attempt   || (typeof selectedAttempt !== 'undefined' ? selectedAttempt : '');
  const shift     = ctx.shift     || (typeof selectedShift   !== 'undefined' ? selectedShift   : '');
  const userScore = ctx.userScore !== undefined ? ctx.userScore : 0;
  const userSubStats = ctx.userSubStats || [];

  const db = firebase.database();
  fetchAnalysisRaw(db, stream, attempt).then(raw => {
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
    const maxScore = stream === 'PCM' ? 200 : 150;
    for (let i = 0; i <= maxScore; i += 20) buckets[i] = 0;
    myScores.forEach(s => {
      const b = Math.floor(s / 20) * 20;
      if (buckets[b] !== undefined) buckets[b]++;
    });

    // ── render stat elements ───────────────────────────────────────────────────
    document.getElementById('analysisTotalBadge').textContent = `${totalAllStreams} total submissions`;
    document.getElementById('analysisTotalAll').textContent   = totalAllStreams;
    document.getElementById('analysisPercentileVal').textContent = `${pct}%`;
    document.getElementById('analysisPercentileSub').textContent =
      `You scored ${userScore}. ${above} students ahead, ${below} students below.`;
    document.getElementById('analysisAhead').textContent    = above;
    document.getElementById('analysisSame').textContent     = same;
    document.getElementById('analysisBelow').textContent    = below;
    document.getElementById('analysisShiftAvg').textContent = myAvg.toFixed(1);
    document.getElementById('analysisShiftHighest').textContent = myHighest;
    document.getElementById('analysisShiftCount').textContent   = myCount;
    document.getElementById('analysisMedian').textContent = median;
    document.getElementById('analysisMean').textContent   = myAvg.toFixed(1);

    // Percentile gauge arc
    const pArc = document.querySelector('.percentile-arc');
    const pFill = document.querySelector('.percentile-arc-fill');
    if (pArc && pFill) drawArcGauge(pArc, pFill, parseFloat(pct) / 100);

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
        const subjMaxMap = { Physics: 50, Chemistry: 50, Mathematics: stream === 'PCM' ? 100 : 50, Biology: 50 };
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
                <span class="subject-compare-row__name">${s}</span>
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
      sel.innerHTML = shiftNames.map(s => `<option value="${s}" ${s === shift ? 'selected' : ''}>${s}</option>`).join('');
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
        <span class="drill-subject-name">${subj}</span>
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

function fetchCommunityFullAnalysis() {
  if (typeof firebase === 'undefined') {
    const el = document.getElementById('commLoading');
    if (el) el.style.display = 'none';
    return;
  }

  // Serve from cache if available
  const cacheKey = 'community';
  const cached = _cacheGet(cacheKey);
  if (cached) {
    _renderCommunityData(cached);
    return;
  }

  const db = firebase.database();

  Promise.all([
    db.ref('stats/PCM/Attempt 1').once('value'),
    db.ref('stats/PCB/Attempt 1').once('value'),
    db.ref('summary').once('value')
  ]).then(([pcmSnap, pcbSnap, summarySnap]) => {
    const payload = {
      pcmStats: pcmSnap.val(),
      pcbStats: pcbSnap.val(),
      summary:  summarySnap.val()
    };
    _cacheSet(cacheKey, payload);
    _renderCommunityData(payload);
  }).catch(err => {
    console.error('Community analysis fetch error:', err);
    document.getElementById('commLoading').style.display = 'none';
  });
}

// Internal renderer — works on either fresh data or cached payload.
function _renderCommunityData({ pcmStats, pcbStats, summary }) {
  if (!pcmStats && !pcbStats) {
    document.getElementById('commLoading').style.display = 'none';
    document.getElementById('commContent').innerHTML =
      '<p style="padding:3rem;text-align:center;color:var(--pewter)">No data yet — be the first to submit!</p>';
    document.getElementById('commContent').style.display = 'block';
    return;
  }

  const pcmShiftMap = buildShiftMapFromStats(pcmStats || {});
  const pcbShiftMap = buildShiftMapFromStats(pcbStats || {});

  // Totals
  let totalAll = (summary && summary.total) || 0;
  let pcmTotal = 0, pcbTotal = 0;
  Object.values(pcmShiftMap).forEach(s => { pcmTotal += s.count; });
  Object.values(pcbShiftMap).forEach(s => { pcbTotal += s.count; });
  if (!totalAll) totalAll = pcmTotal + pcbTotal;
  if (summary && summary.streams) {
    pcmTotal = summary.streams.PCM || pcmTotal;
    pcbTotal = summary.streams.PCB || pcbTotal;
  }

  // All scores combined
  let allScores = [];
  Object.values(pcmShiftMap).forEach(s => { allScores = allScores.concat(s.scores); });
  Object.values(pcbShiftMap).forEach(s => { allScores = allScores.concat(s.scores); });

  // All shift names
  const pcmShiftNames = Object.keys(pcmShiftMap).sort();
  const pcbShiftNames = Object.keys(pcbShiftMap).sort();
  const allShiftNames = [...new Set([...pcmShiftNames, ...pcbShiftNames])].sort();

  // Merge shift maps for combined view
  const mergedShiftMap = {};
  allShiftNames.forEach(s => {
    const pcm = pcmShiftMap[s] || { scores: [], subjectSums: {}, count: 0, sum: 0, highest: -Infinity };
    const pcb = pcbShiftMap[s] || { scores: [], subjectSums: {}, count: 0, sum: 0, highest: -Infinity };
    mergedShiftMap[s] = {
      scores: [...pcm.scores, ...pcb.scores],
      count: pcm.count + pcb.count,
      highest: Math.max(pcm.highest, pcb.highest),
      subjectSums: { ...pcm.subjectSums }
    };
    // Merge pcb subjects
    for (const subj in pcb.subjectSums) {
      mergedShiftMap[s].subjectSums[subj] = (mergedShiftMap[s].subjectSums[subj] || 0) + pcb.subjectSums[subj];
    }
  });

  // Stats
  const sorted = [...allScores].sort((a, b) => a - b);
  const median = sorted.length > 0
    ? (sorted.length % 2 === 0
        ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
        : sorted[Math.floor(sorted.length / 2)])
    : '—';
  const mean = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : '—';

  // Badge
  document.getElementById('commTotalBadge').textContent = `${totalAll} total submissions`;

  const colors = getChartColors();

  // Destroy old charts
  Object.values(_communityCharts).forEach(c => { try { c.destroy(); } catch(e){} });
  _communityCharts = {};

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
      data: { labels: bucketLabels, datasets: [{ label: 'Students', data: bucketVals, backgroundColor: 'rgba(96,165,250,.5)', borderRadius: 4 }] },
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
      ['Min', sorted[0]], ['Max', sorted[sorted.length - 1]], ['Participants', totalAll]
    ].map(([l, v]) => `<div class="dist-stat"><div class="dist-stat__val">${v}</div><div class="dist-stat__lbl">${l}</div></div>`).join('');
  }

  // ── Shift Avg Chart ──
  const shiftAvgs = allShiftNames.map(s => {
    const d = mergedShiftMap[s];
    return d.count > 0 ? parseFloat((d.scores.reduce((a, b) => a + b, 0) / d.count).toFixed(1)) : 0;
  });
  const shiftAvgCtx = document.getElementById('comm-shiftAvgChart');
  if (shiftAvgCtx) {
    _communityCharts.shiftAvg = new Chart(shiftAvgCtx, {
      type: 'bar',
      data: { labels: allShiftNames, datasets: [{ label: 'Avg Score', data: shiftAvgs, backgroundColor: 'rgba(96,165,250,.55)', borderRadius: 6 }] },
      options: { ...baseChartOptions(colors), indexAxis: 'y', plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
    });
  }

  // ── Participants per Shift ──
  const shiftCounts = allShiftNames.map(s => mergedShiftMap[s].count);
  const partCtx = document.getElementById('comm-participantsChart');
  if (partCtx) {
    _communityCharts.participants = new Chart(partCtx, {
      type: 'bar',
      data: { labels: allShiftNames, datasets: [{ label: 'Students', data: shiftCounts, backgroundColor: 'rgba(192,132,252,.55)', borderRadius: 4 }] },
      options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
    });
  }

  // ── Highest per Shift ──
  const shiftHighs = allShiftNames.map(s => mergedShiftMap[s].highest === -Infinity ? 0 : mergedShiftMap[s].highest);
  const highCtx = document.getElementById('comm-highestChart');
  if (highCtx) {
    _communityCharts.highest = new Chart(highCtx, {
      type: 'bar',
      data: { labels: allShiftNames, datasets: [{ label: 'Highest Score', data: shiftHighs, backgroundColor: 'rgba(192,132,252,.6)', borderRadius: 4 }] },
      options: { ...baseChartOptions(colors), plugins: { ...baseChartOptions(colors).plugins, legend: { display: false } } }
    });
  }

  // ── Subject Avg per Shift ──
  const allSubjects = [...new Set(Object.values(mergedShiftMap).flatMap(sd => Object.keys(sd.subjectSums)))];
  const subjectColors = { Physics: '#00d4ff', Chemistry: '#c084fc', Mathematics: colors.accent, Biology: '#22c55e' };
  const shiftSubjCtx = document.getElementById('comm-shiftSubjectChart');
  if (shiftSubjCtx && allSubjects.length > 0) {
    _communityCharts.shiftSubject = new Chart(shiftSubjCtx, {
      type: 'bar',
      data: {
        labels: allShiftNames,
        datasets: allSubjects.map(subj => ({
          label: subj,
          data: allShiftNames.map(s => {
            const sd = mergedShiftMap[s];
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
  document.getElementById('commTotalAll').textContent = totalAll;
  document.getElementById('commMedian').textContent = median;
  document.getElementById('commMean').textContent = mean;

  // ── Drill Down Selector ──
  const sel = document.getElementById('commShiftSelect');
  if (sel) {
    sel.innerHTML = allShiftNames.map(s => `<option value="${s}">${s}</option>`).join('');
    window._commShiftMapData = mergedShiftMap;
    renderCommShiftDrillDown(allShiftNames[0]);
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
        <span class="drill-subject-name">${subj}</span>
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
