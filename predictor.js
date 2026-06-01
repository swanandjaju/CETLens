/*
 * Percentile Predictor
 *
 * All 2025 historical data (marks vs percentile curves and shift difficulty
 * ranking) is embedded directly — no external files needed at runtime.
 * Only live 2026 shift stats are fetched from Supabase.
 */

'use strict';

const PREDICTOR_LIVE_REFRESH_MS = 30000;

let _predictorStream = 'PCM';
let _predictorRequestSeq = 0;
let _predictorOptionsSeq = 0;
let _predictorLiveRows = [];
let _predictorRefreshTimer = null;

// --- MANUAL OVERRIDE (ANTI-TROLL PROTECTION) 
// If trolls spam fake 200/200 scores, it will inflate averages and crash genuine percentiles.
// Set PREDICTOR_USE_LIVE_DATA to false to freeze the predictor and use your manually verified rankings below.
const PREDICTOR_USE_LIVE_DATA = false;

// When PREDICTOR_USE_LIVE_DATA is false, the predictor will use this array.
// Simply list the shifts in order from HARDEST (index 0) to EASIEST (last index).
// You only need to provide the 'shift' name. The predictor will map them sequentially.
const MANUAL_DIFFICULTY_RANKING = [
  { shift: '11 April - Evening' },
  { shift: '20 April - Morning' },
  { shift: '18 April - Evening' },
  { shift: '16 April - Morning' },
  { shift: '18 April - Morning' },
  { shift: '19 April - Evening' },
  { shift: '15 April - Morning' },
  { shift: '20 April - Evening' },
  { shift: '17 April - Evening' },
  { shift: '13 April - Morning' },
  { shift: '13 April - Evening' },
  { shift: '17 April - Morning' },
  { shift: '19 April - Morning' },
  { shift: '16 April - Evening' },
  { shift: '15 April - Evening' },
  { shift: '11 April - Morning' },
];

// --- 2025 REFERENCE RANKING (hardest  easiest by % scoring 120) 
const PREDICTOR_REFERENCE_RANKING = [
  '21st April S2',   // 6.80%   Hardest
  '20th April S2',   // 9.10%
  '22nd April S2',   // 10.10%
  '21st April S1',   // 12.40%
  '5th May S2',      // 14.30%
  '23rd April S1',   // 14.30%
  '22nd April S1',   // 14.30%
  '19th April S2',   // 14.40%
  '25th April S1',   // 14.90%
  '20th April S1',   // 15.20%
  '23rd April S2',   // 15.50%
  '25th April S2',   // 15.50%
  '26th April S1',   // 15.70%
  '26th April S2',   // 15.70%
  '19th April S1'    // 26.50%  Easiest
];

// --- 2025 HISTORICAL MARKS  PERCENTILE CURVES 
// Each key is a shift name; value is an array of {marks, percentile} points
// sorted by marks ascending. Data from exam_results.xlsx.
const PREDICTOR_HISTORICAL_CURVES = {
  '19th April S1': [
    { marks: 69, percentile: 72.13 },
    { marks: 74, percentile: 83.0 },
    { marks: 96, percentile: 92.6 },
    { marks: 104, percentile: 94.94 },
    { marks: 113, percentile: 96.67 },
    { marks: 117, percentile: 97.02 },
    { marks: 121, percentile: 97.7 },
    { marks: 130, percentile: 98.3 },
    { marks: 151, percentile: 99.62 },
  ],
  '19th April S2': [
    { marks: 62, percentile: 43.0 },
    { marks: 74, percentile: 83.0 },
    { marks: 80, percentile: 87.0 },
    { marks: 85, percentile: 89.67 },
    { marks: 92, percentile: 93.25 },
    { marks: 115, percentile: 98.0 },
    { marks: 122, percentile: 98.41 },
    { marks: 140, percentile: 99.5 },
  ],
  '20th April S1': [
    { marks: 70, percentile: 77.0 },
    { marks: 76, percentile: 81.33 },
    { marks: 97, percentile: 93.98 },
    { marks: 114, percentile: 97.09 },
    { marks: 117, percentile: 98.15 },
    { marks: 122, percentile: 98.4 },
    { marks: 132, percentile: 98.99 },
    { marks: 147, percentile: 99.57 },
  ],
  '20th April S2': [
    { marks: 71, percentile: 84.97 },
    { marks: 75, percentile: 86.0 },
    { marks: 84, percentile: 87.4 },
    { marks: 102, percentile: 95.3 },
    { marks: 120, percentile: 97.86 },
    { marks: 124, percentile: 98.51 },
    { marks: 135, percentile: 99.26 },
    { marks: 140, percentile: 99.47 },
    { marks: 146, percentile: 99.58 },
    { marks: 153, percentile: 99.74 },
  ],
  '21st April S1': [
    { marks: 60, percentile: 71.0 },
    { marks: 65, percentile: 75.0 },
    { marks: 91, percentile: 91.93 },
    { marks: 93, percentile: 94.96 },
    { marks: 110, percentile: 97.39 },
    { marks: 134, percentile: 99.01 },
    { marks: 136, percentile: 99.01 },
    { marks: 141, percentile: 99.52 },
    { marks: 146, percentile: 99.6 },
    { marks: 167, percentile: 99.9 },
  ],
  '21st April S2': [
    { marks: 39, percentile: 53.0 },
    { marks: 56, percentile: 60.0 },
    { marks: 65, percentile: 75.0 },
    { marks: 83, percentile: 91.3 },
    { marks: 88, percentile: 93.1 },
    { marks: 120, percentile: 98.5 },
    { marks: 128, percentile: 98.987 },
    { marks: 178, percentile: 99.97 },
  ],
  '22nd April S1': [
    { marks: 94, percentile: 93.0 },
    { marks: 109, percentile: 96.16 },
    { marks: 136, percentile: 99.03 },
    { marks: 144, percentile: 99.4 },
  ],
  '22nd April S2': [
    { marks: 53, percentile: 39.0 },
    { marks: 57, percentile: 60.0 },
    { marks: 83, percentile: 87.0 },
    { marks: 98, percentile: 94.2 },
    { marks: 99, percentile: 94.91 },
    { marks: 112, percentile: 96.99 },
    { marks: 114, percentile: 97.5 },
    { marks: 125, percentile: 98.26 },
    { marks: 129, percentile: 98.63 },
    { marks: 139, percentile: 99.22 },
    { marks: 142, percentile: 99.46 },
    { marks: 160, percentile: 99.86 },
  ],
  '23rd April S1': [
    { marks: 57, percentile: 45.0 },
    { marks: 68, percentile: 75.0 },
    { marks: 78, percentile: 87.59 },
    { marks: 104, percentile: 95.9 },
    { marks: 109, percentile: 96.4 },
    { marks: 126, percentile: 98.49 },
    { marks: 130, percentile: 98.6 },
    { marks: 140, percentile: 99.3 },
    { marks: 153, percentile: 99.73 },
  ],
  '23rd April S2': [
    { marks: 76, percentile: 82.0 },
    { marks: 84, percentile: 86.3 },
    { marks: 89, percentile: 88.0 },
    { marks: 91, percentile: 91.31 },
    { marks: 94, percentile: 92.5 },
    { marks: 98, percentile: 94.26 },
    { marks: 128, percentile: 98.2 },
    { marks: 135, percentile: 98.82 },
    { marks: 154, percentile: 99.645 },
  ],
  '25th April S1': [
    { marks: 64, percentile: 62.0 },
    { marks: 89, percentile: 88.24 },
    { marks: 99, percentile: 93.7 },
    { marks: 102, percentile: 94.69 },
    { marks: 104, percentile: 95.92 },
    { marks: 144, percentile: 99.41 },
  ],
  '25th April S2': [
    { marks: 60, percentile: 58.0 },
    { marks: 82, percentile: 89.51 },
    { marks: 88, percentile: 91.3 },
    { marks: 90, percentile: 94.4 },
    { marks: 126, percentile: 98.8 },
    { marks: 144, percentile: 99.33 },
    { marks: 150, percentile: 99.57 },
    { marks: 152, percentile: 99.653 },
  ],
  '26th April S1': [
    { marks: 58, percentile: 61.0 },
    { marks: 63, percentile: 71.5 },
    { marks: 74, percentile: 75.8 },
    { marks: 80, percentile: 87.33 },
    { marks: 93, percentile: 93.0 },
    { marks: 99, percentile: 95.25 },
    { marks: 100, percentile: 95.25 },
    { marks: 103, percentile: 95.59 },
    { marks: 125, percentile: 98.46 },
    { marks: 140, percentile: 99.1 },
    { marks: 142, percentile: 99.38 },
    { marks: 151, percentile: 99.6 },
  ],
  '26th April S2': [
    { marks: 59, percentile: 39.0 },
    { marks: 66, percentile: 63.0 },
    { marks: 75, percentile: 82.33 },
    { marks: 93, percentile: 92.8 },
    { marks: 98, percentile: 94.81 },
    { marks: 105, percentile: 95.61 },
    { marks: 116, percentile: 97.51 },
    { marks: 118, percentile: 97.87 },
    { marks: 131, percentile: 98.77 },
    { marks: 155, percentile: 99.7 },
    { marks: 159, percentile: 99.8 },
    { marks: 172, percentile: 99.94 },
  ],
  '5th May S2': [
    { marks: 77, percentile: 88.0 },
    { marks: 80, percentile: 88.56 },
    { marks: 86, percentile: 90.07 },
    { marks: 109, percentile: 96.66 },
    { marks: 114, percentile: 97.1 },
    { marks: 133, percentile: 99.1 },
    { marks: 147, percentile: 99.42 },
    { marks: 149, percentile: 99.48 },
    { marks: 151, percentile: 99.59 },
  ],
};


// --- UI FUNCTIONS 

function openPredictorDisclaimer() {
  const overlay = document.getElementById('predictorDisclaimerOverlay');
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closePredictorDisclaimer() {
  const overlay = document.getElementById('predictorDisclaimerOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function acceptPredictorDisclaimer() {
  closePredictorDisclaimer();
  openPredictorScreen();
}

function openPredictorScreen() {
  closePredictorDisclaimer();

  const idsToHide = ['uploadScreen', 'loadingScreen', 'dashboard', 'analysisScreen', 'communityScreen'];
  idsToHide.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const lp = document.getElementById('landingPage');
  if (lp) lp.style.display = 'none';

  const uploadThemeBtn = document.getElementById('uploadThemeBtn');
  if (uploadThemeBtn) uploadThemeBtn.style.display = 'none';

  const screen = document.getElementById('predictorScreen');
  if (screen) screen.style.display = 'flex';

  document.body.classList.remove('upload-active');
  document.body.style.overflow = '';
  initPredictorControls();
  startPredictorLiveRefresh();
}

function closePredictorScreen() {
  closePredictorDisclaimer();
  stopPredictorLiveRefresh();
  const screen = document.getElementById('predictorScreen');
  if (screen) screen.style.display = 'none';

  const lp = document.getElementById('landingPage');
  if (lp) lp.style.display = '';

  const up = document.getElementById('uploadScreen');
  if (up) up.style.display = 'flex';

  const uploadThemeBtn = document.getElementById('uploadThemeBtn');
  if (uploadThemeBtn) uploadThemeBtn.style.display = '';

  document.body.classList.add('upload-active');
  resetPredictorInputs();
}

function initPredictorControls() {
  populatePredictorAttempts([]);
  populatePredictorShifts([]);
}

function resetPredictorInputs() {
  _predictorStream = 'PCM';
  _predictorRequestSeq++;
  _predictorOptionsSeq++;
  _predictorLiveRows = [];
  populatePredictorAttempts([]);
  populatePredictorShifts([]);

  const attempt = document.getElementById('predictorAttemptSelect');
  const shift = document.getElementById('predictorShiftSelect');
  const marks = document.getElementById('predictorMarksInput');
  if (attempt) attempt.value = '';
  if (shift) shift.value = '';
  if (marks) marks.value = '';

  setPredictorResult('--', 'Select attempt, shift, and marks.');
  setPredictorStatus('', '');
}

function populatePredictorAttempts(rows) {
  const select = document.getElementById('predictorAttemptSelect');
  if (!select) return;
  const current = select.value;
  const attempts = [...new Set((rows || [])
    .map(row => String(row.attempt || '').trim())
    .filter(Boolean))];

  select.innerHTML = '<option value="" disabled selected>' +
    (attempts.length ? 'Select attempt...' : 'No live attempts yet') +
    '</option>' +
    attempts.map(attempt => '<option value="' + window.escapeHtml(attempt) + '">' + window.escapeHtml(attempt) + '</option>').join('');

  if (attempts.includes(current)) {
    select.value = current;
  } else if (attempts.length === 1) {
    select.value = attempts[0];
  } else {
    select.value = '';
  }
}

function populatePredictorShifts(rows) {
  const select = document.getElementById('predictorShiftSelect');
  if (!select) return;
  const current = select.value;
  const attempt = document.getElementById('predictorAttemptSelect')?.value || '';
  const shifts = [...new Set((rows || [])
    .filter(row => !attempt || row.attempt === attempt)
    .map(row => String(row.shift || '').trim())
    .filter(Boolean))];

  select.innerHTML = '<option value="" disabled selected>' +
    (attempt ? (shifts.length ? 'Select shift...' : 'No live shifts for attempt') : 'Select attempt first') +
    '</option>' +
    shifts.map(shift => '<option value="' + window.escapeHtml(shift) + '">' + window.escapeHtml(shift) + '</option>').join('');

  if (shifts.includes(current)) select.value = current;
  else select.value = '';
}

function onPredictorMarksInput() {
  const input = document.getElementById('predictorMarksInput');
  if (!input) return;
  const cleaned = String(input.value).replace(/[^\d]/g, '');
  if (cleaned !== input.value) input.value = cleaned;
  const n = parseInt(input.value, 10);
  if (Number.isFinite(n) && n > 200) input.value = '200';
  onPredictorInputChange();
}

function onPredictorAttemptChange() {
  populatePredictorShifts(_predictorLiveRows);
  onPredictorInputChange();
}

function onPredictorInputChange() {
  const attempt = document.getElementById('predictorAttemptSelect')?.value || '';
  const shift = document.getElementById('predictorShiftSelect')?.value || '';
  const marksRaw = document.getElementById('predictorMarksInput')?.value || '';

  _predictorRequestSeq++;
  const seq = _predictorRequestSeq;

  if (!attempt || !shift || marksRaw === '') {
    setPredictorResult('--', 'Select attempt, shift, and marks.');
    setPredictorStatus('', '');
    return;
  }

  const marks = Number(marksRaw);
  if (!Number.isFinite(marks) || marks < 0 || marks > 200) {
    setPredictorResult('--', 'Marks must be a number from 0 to 200.');
    setPredictorStatus('Marks must be within 0-200.', 'error');
    return;
  }

  updatePredictorPrediction(seq, _predictorStream, attempt, shift, marks);
}


// --- LIVE DATA 

function startPredictorLiveRefresh() {
  stopPredictorLiveRefresh();
  refreshPredictorLiveOptions({ silent: false });
  _predictorRefreshTimer = setInterval(() => {
    const screen = document.getElementById('predictorScreen');
    if (screen && screen.style.display === 'flex') {
      refreshPredictorLiveOptions({ silent: true });
    }
  }, PREDICTOR_LIVE_REFRESH_MS);
}

function stopPredictorLiveRefresh() {
  if (_predictorRefreshTimer) {
    clearInterval(_predictorRefreshTimer);
    _predictorRefreshTimer = null;
  }
}

async function refreshPredictorLiveOptions(options) {
  const silent = !!(options && options.silent);
  const seq = ++_predictorOptionsSeq;

  if (!silent) {
    setPredictorStatus('Fetching live Supabase shift statistics...', 'loading');
  }

  try {
    const rows = await fetchPredictorLiveRows(_predictorStream);
    if (seq !== _predictorOptionsSeq) return;

    _predictorLiveRows = rows;
    populatePredictorAttempts(rows);
    populatePredictorShifts(rows);

    if (rows.length === 0) {
      setPredictorResult('--', 'Prediction unavailable.');
      setPredictorStatus('No live Supabase shift statistics are available for ' + _predictorStream + ' yet.', 'error');
      return;
    }

    if (!silent) {
      setPredictorStatus('Live shift list loaded from Supabase.', 'success');
    }

    onPredictorInputChange();
  } catch (err) {
    if (seq !== _predictorOptionsSeq) return;
    const message = err && err.message ? err.message : 'Live shift statistics could not be fetched.';
    _predictorLiveRows = [];
    populatePredictorAttempts([]);
    populatePredictorShifts([]);
    setPredictorResult('--', 'Prediction unavailable.');
    setPredictorStatus(message, 'error');
  }
}

async function fetchPredictorLiveRows(stream) {
  const sb = window._supabaseClient;
  if (!sb) throw new Error('Supabase client is unavailable.');

  let response;
  try {
    response = await sb.from('shift_stats')
      .select('attempt,shift,count,total_score,score_counts')
      .eq('stream', stream);
  } catch (err) {
    throw new Error('Supabase live shift statistics request failed. Check your internet connection and run the app over HTTP/localhost, not file://.');
  }

  const { data, error } = response;
  if (error) throw new Error('Supabase shift statistics could not be fetched.');

  return (data || [])
    .filter(row => row && Number(row.count) >= 3 && row.attempt && row.shift && !String(row.shift).toLowerCase().includes('18 may'))
    .map(row => {
      let parsedScores = row.score_counts || {};
      if (typeof parsedScores === 'string') {
        try { parsedScores = JSON.parse(parsedScores); } catch(e) { console.warn('Predictor: JSON parse error in live rows', e); }
      }
      return {
        attempt: String(row.attempt),
        shift: String(row.shift),
        count: Number(row.count),
        total_score: Number(row.total_score),
        score_counts: parsedScores
      };
    });
}


// --- CORE PREDICTION 

async function updatePredictorPrediction(seq, stream, attempt, shift, marks) {
  setPredictorResult('--', 'Fetching live shift statistics…');
  setPredictorStatus('Fetching live Supabase shift statistics...', 'loading');

  try {
    const currentRanking = await fetchPredictorCurrentRanking(stream, attempt);
    if (seq !== _predictorRequestSeq) return;

    const currentIndex = currentRanking.findIndex(item => item.shift === shift);
    if (currentIndex === -1) {
      const avail = currentRanking.map(r => r.shift).join(', ');
      throw new Error('Shift not found in ranking! Available (' + currentRanking.length + '): ' + avail);
    }

    const selectedRank = currentRanking[currentIndex];
    if (selectedRank.hasDifficultyTie) {
      throw new Error('Selected shift has the same average and median as another live shift; a unique difficulty rank is unavailable.');
    }

    let mappedIndex;
    if (currentRanking.length <= 1) {
      mappedIndex = 0;
    } else {
      mappedIndex = Math.round(currentIndex * (PREDICTOR_REFERENCE_RANKING.length - 1) / (currentRanking.length - 1));
    }

    const rawPercentiles = PREDICTOR_REFERENCE_RANKING.map(shiftName => {
      const curve = PREDICTOR_HISTORICAL_CURVES[shiftName];
      if (!curve || curve.length < 2) return 0;
      return interpolatePredictorCurve(curve, marks);
    });

    for (let i = rawPercentiles.length - 2; i >= 0; i--) {
      if (rawPercentiles[i] < rawPercentiles[i + 1]) {
        rawPercentiles[i] = rawPercentiles[i + 1];
      }
    }

    const percentile = rawPercentiles[mappedIndex];
    if (!percentile || percentile <= 0) {
      throw new Error('Percentile data is currently unavailable for this shift.');
    }

    const rawPMin = rawPercentiles[Math.min(mappedIndex + 1, rawPercentiles.length - 1)];
    const rawPMax = rawPercentiles[Math.max(mappedIndex - 1, 0)];

    let margin = Math.max(Math.abs(percentile - rawPMin), Math.abs(rawPMax - percentile));

    // If the data curves perfectly flatline (e.g. due to monotonicity smoothing),
    // enforce a minimum 0.1 margin so the UI doesn't randomly disappear.
    if (margin < 0.1) {
      margin = 0.1;
    }

    const finalPMin = Math.max(0, percentile - margin);
    const finalPMax = Math.min(100, percentile + margin);

    const formatted = percentile.toFixed(4);
    let metaText = '';
    
    const metaEl = document.getElementById('predictorResultMeta');
    metaText = 'Expected Range: ' + finalPMin.toFixed(4) + ' - ' + finalPMax.toFixed(4);
    if (metaEl) metaEl.style.display = 'block';

    setPredictorResult(formatted, metaText);
    setPredictorStatus('', '');
  } catch (err) {
    if (seq !== _predictorRequestSeq) return;
    const message = err && err.message ? err.message : 'Prediction unavailable.';
    setPredictorResult('--', 'Prediction unavailable.');
    setPredictorStatus(message, 'error');
  }
}

async function fetchPredictorCurrentRanking(stream, attempt) {
  if (!PREDICTOR_USE_LIVE_DATA && String(attempt).trim() === 'Attempt 1') {
    if (!MANUAL_DIFFICULTY_RANKING || MANUAL_DIFFICULTY_RANKING.length === 0) {
      throw new Error('Predictor is frozen but MANUAL_DIFFICULTY_RANKING is empty.');
    }
    // Provide dummy difficulty scores so the UI still displays them, evenly spaced from 0.95 to 0.05
    return MANUAL_DIFFICULTY_RANKING.map((row, index) => {
      const difficultyScore = 0.95 - (index * (0.90 / Math.max(1, MANUAL_DIFFICULTY_RANKING.length - 1)));
      return {
        shift: row.shift,
        difficultyScore: difficultyScore
      };
    });
  }

  // Use globally cached rows instead of a redundant Supabase fetch on every keystroke
  let data = _predictorLiveRows.filter(r => r.attempt === attempt);
  
  if (data.length === 0) {
    // Fallback: fetch directly if cache is empty
    const sb = window._supabaseClient;
    if (!sb) throw new Error('Supabase client is unavailable.');

    let response;
    try {
      response = await sb.from('shift_stats')
        .select('shift,count,total_score,score_counts')
        .eq('stream', stream)
        .eq('attempt', attempt);
    } catch (err) {
      throw new Error('Supabase live shift statistics request failed. Check your internet connection and run the app over HTTP/localhost, not file://.');
    }

    const { data: fetchResult, error } = response;
    if (error) throw new Error('Supabase shift statistics could not be fetched.');
    data = fetchResult || [];
  }

  const rows = data
    .filter(row => row && Number(row.count) >= 3)
    .map(row => {
      let derivedCount = 0;
      let derivedTotal = 0;
      let above120Count = 0;
      let below80Count = 0;
      let scoreCounts = row.score_counts || {};
      if (typeof scoreCounts === 'string') {
        try { scoreCounts = JSON.parse(scoreCounts); } catch(e) { console.warn('Predictor: JSON parse error in current ranking', e); }
      }
      for (const [scoreStr, cStr] of Object.entries(scoreCounts)) {
        const score = Number(scoreStr);
        const c = Number(cStr);
        if (Number.isFinite(score) && Number.isFinite(c)) {
          derivedCount += c;
          derivedTotal += (score * c);
          if (score >= 120) above120Count += c;
          if (score < 80) below80Count += c;
        }
      }
      
      const count = derivedCount;
      const total = derivedTotal;
      const median = predictorMedianFromScoreCounts(scoreCounts);
      const average = count > 0 ? total / count : NaN;
      
      let varianceSum = 0;
      let skewnessSum = 0;
      if (count > 1 && Number.isFinite(average)) {
        for (const [scoreStr, cStr] of Object.entries(scoreCounts)) {
          const score = Number(scoreStr);
          const c = Number(cStr);
          if (Number.isFinite(score) && Number.isFinite(c)) {
             const diff = score - average;
             varianceSum += c * (diff * diff);
             skewnessSum += c * (diff * diff * diff);
          }
        }
      }
      const stdDev = count > 1 ? Math.sqrt(varianceSum / count) : 0;
      const skewness = (stdDev > 0) ? (skewnessSum / count) / (stdDev * stdDev * stdDev) : 0;

      const pctAbove120 = count > 0 ? (above120Count / count) * 100 : 0;
      const pctBelow80 = count > 0 ? (below80Count / count) * 100 : 0;

      return {
        shift: row.shift,
        count,
        average,
        median,
        skewness,
        pctAbove120,
        pctBelow80
      };
    })
    .filter(row => row.shift && Number.isFinite(row.average));

  if (rows.length === 0) {
    throw new Error('No active live shift statistics are available for ' + stream + ' ' + attempt + '.');
  }

  const minAvg = Math.min(...rows.map(r => r.average));
  const maxAvg = Math.max(...rows.map(r => r.average));
  const minMedian = Math.min(...rows.map(r => r.median));
  const maxMedian = Math.max(...rows.map(r => r.median));
  const minAbove120 = Math.min(...rows.map(r => r.pctAbove120));
  const maxAbove120 = Math.max(...rows.map(r => r.pctAbove120));
  const minBelow80 = Math.min(...rows.map(r => r.pctBelow80));
  const maxBelow80 = Math.max(...rows.map(r => r.pctBelow80));
  const minSkew = Math.min(...rows.map(r => r.skewness));
  const maxSkew = Math.max(...rows.map(r => r.skewness));

  rows.forEach(row => {
    const normalizedAvg = maxAvg > minAvg ? (row.average - minAvg) / (maxAvg - minAvg) : 0.5;
    const normalizedMedian = maxMedian > minMedian ? (row.median - minMedian) / (maxMedian - minMedian) : 0.5;
    const normalizedAbove120 = maxAbove120 > minAbove120 ? (row.pctAbove120 - minAbove120) / (maxAbove120 - minAbove120) : 0.5;
    const normalizedBelow80 = maxBelow80 > minBelow80 ? (row.pctBelow80 - minBelow80) / (maxBelow80 - minBelow80) : 0.5;
    const normalizedSkew = maxSkew > minSkew ? (row.skewness - minSkew) / (maxSkew - minSkew) : 0.5;

    if (String(attempt).trim() === 'Attempt 2') {
      row.difficultyScore = (
        (1 - normalizedAvg) * 0.20 +
        (1 - normalizedMedian) * 0.20 +
        (1 - normalizedAbove120) * 0.25 +
        normalizedBelow80 * 0.15 +
        normalizedSkew * 0.20
      );
    } else {
      row.difficultyScore = (
        (1 - normalizedAvg) * 0.25 +
        (1 - normalizedMedian) * 0.25 +
        (1 - normalizedAbove120) * 0.30 +
        normalizedBelow80 * 0.20
      );
    }
  });

  // Hardest first: higher difficultyScore first
  rows.sort((a, b) => b.difficultyScore - a.difficultyScore);

  rows.forEach(row => {
    row.hasDifficultyTie = rows.some(other =>
      other !== row &&
      Math.abs(other.difficultyScore - row.difficultyScore) < 0.0001
    );
  });

  return rows;
}


// --- INTERPOLATION 

function interpolatePredictorCurve(curve, marks) {
  const points = [...curve].sort((a, b) => a.marks - b.marks);

  for (const point of points) {
    if (point.marks === marks) return point.percentile;
  }

  const first = points[0];
  if (marks < first.marks) {
    const diffMarks = first.marks - marks;
    return Math.max(0, first.percentile - diffMarks * 0.5);
  }

  const last = points[points.length - 1];
  if (marks > last.marks) {
    const diffMarks = marks - last.marks;
    return Math.min(100, last.percentile + diffMarks * 0.01);
  }

  let i = 0;
  while (i < points.length && points[i].marks < marks) {
    i++;
  }

  const lower = points[i - 1];
  const upper = points[i];

  const toLogit = p => {
    let cp = Math.max(0.0001, Math.min(99.9999, p));
    return Math.log(cp / (100 - cp));
  };
  const fromLogit = l => 100 * Math.exp(l) / (1 + Math.exp(l));

  const fraction = (marks - lower.marks) / (upper.marks - lower.marks);
  const logitLower = toLogit(lower.percentile);
  const logitUpper = toLogit(upper.percentile);
  
  return fromLogit(logitLower + fraction * (logitUpper - logitLower));
}

function predictorMedianFromScoreCounts(scoreCounts) {
  const entries = Object.entries(scoreCounts || {})
    .map(([score, count]) => [Number(score), Number(count)])
    .filter(([score, count]) => Number.isFinite(score) && Number.isFinite(count) && count > 0)
    .sort((a, b) => a[0] - b[0]);

  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total <= 0) return NaN;

  const mid1 = Math.floor((total - 1) / 2);
  const mid2 = Math.floor(total / 2);
  let cumulative = 0;
  let first = null;
  let second = null;

  for (const [score, count] of entries) {
    const next = cumulative + count;
    if (first === null && mid1 < next) first = score;
    if (second === null && mid2 < next) {
      second = score;
      break;
    }
    cumulative = next;
  }

  return (first + second) / 2;
}


// --- UI HELPERS 

function setPredictorResult(value, meta) {
  const result = document.getElementById('predictorResult');
  const resultMeta = document.getElementById('predictorResultMeta');
  if (result) result.textContent = value;
  if (resultMeta) resultMeta.textContent = meta || '';
}

function setPredictorStatus(message, type) {
  const status = document.getElementById('predictorStatus');
  if (!status) return;
  status.textContent = message || '';
  status.className = 'predictor-status' + (type ? ' is-' + type : '');
}


document.addEventListener('DOMContentLoaded', () => {
  initPredictorControls();
});
