/**
 * router.js — CETLens Hash Router
 *
 * Add this ONE line to index.html, after the script.js line:
 *   <script src="router.js"></script>
 *
 * Routes:
 *   /             → Home / Upload screen
 *   /#community   → Community Live Analysis
 *   /#dashboard   → Results Dashboard
 *   /#analysis    → Shift-wise Live Analysis
 */

'use strict';

// ---
// PART 1: Wrap existing screen functions so they update the URL automatically
// ---

const _origShowDash = showDash;
showDash = qs => {
  _origShowDash(qs);
  history.pushState(null, '', '#dashboard');
};



const _origResetApp = resetApp;
resetApp = () => {
  _origResetApp();
  history.pushState(null, '', location.pathname);
};

const _origOpenAnalysisScreen = openAnalysisScreen;
openAnalysisScreen = () => {
  _origOpenAnalysisScreen();
  history.pushState(null, '', '#analysis');
};

const _origCloseAnalysisScreen = closeAnalysisScreen;
closeAnalysisScreen = () => {
  _origCloseAnalysisScreen();
  history.pushState(null, '', '#dashboard');
};

const _origOpenCommunityScreen = openCommunityScreen;
openCommunityScreen = () => {
  _origOpenCommunityScreen();
  history.pushState(null, '', '#community');
};

const _origCloseCommunityScreen = closeCommunityScreen;
closeCommunityScreen = () => {
  _origCloseCommunityScreen();
  history.pushState(null, '', location.pathname);
};

const _origOpenPredictorScreen = openPredictorScreen;
openPredictorScreen = () => {
  _origOpenPredictorScreen();
  history.pushState(null, '', '#predictor');
};

const _origClosePredictorScreen = closePredictorScreen;
closePredictorScreen = () => {
  _origClosePredictorScreen();
  history.pushState(null, '', location.pathname);
};


// ---
// PART 2: Override checkStoredSession — controls when the popup shows
//
//   On /           → show popup as normal (existing behaviour)
//   On /#dashboard → silently restore session, no popup
//   On /#analysis  → silently restore session + open analysis, no popup
//   On any hash    → if no session exists, redirect to home
// ---

const _origCheckStoredSession = checkStoredSession;
checkStoredSession = () => {
  const hash = window.location.hash;

  // Home — show the popup exactly as before
  if (!hash || hash === '#') {
    _origCheckStoredSession();
    return;
  }

  // Community — no session needed, popup would be irrelevant
  if (hash === '#community') return;
  if (hash === '#predictor') {
    _origOpenPredictorScreen();
    return;
  }

  // Dashboard or Analysis — silently restore without popup
  if (hash === '#dashboard' || hash === '#analysis') {
    let session = null;
    try { session = JSON.parse(localStorage.getItem('examSession')); } catch (e) {}

    const success = restoreSessionSilently(session, () => {
      _origShowDash(session.questions, true);
      if (hash === '#analysis') {
        setTimeout(() => _origOpenAnalysisScreen(), 100);
      }
    });

    if (!success) {
      // No session — redirect home with a message
      history.replaceState(null, '', location.pathname);
      const msg = document.createElement('div');
      msg.textContent = 'Please upload your response sheet first.';
      msg.style.cssText = `
        position:fixed; top:1.5rem; left:50%; transform:translateX(-50%);
        background:var(--charcoal); color:var(--text); border:1px solid var(--accent);
        padding:.65rem 1.25rem; border-radius:10px; font-size:13px;
        font-family:inherit; z-index:99999; box-shadow:0 8px 24px rgba(0,0,0,.4);
      `;
      document.body.appendChild(msg);
      setTimeout(() => msg.remove(), 3500);
    }
  }
};


// ---
// PART 3: Router — handles hash changes (browser back / forward)
// ---

function handleRoute() {
  const hash = window.location.hash;

  if (hash === '#community') {
    const cs = document.getElementById('communityScreen');
    if (cs && cs.style.display !== 'flex') _origOpenCommunityScreen();
    return;
  }

  if (hash === '#predictor') {
    const ps = document.getElementById('predictorScreen');
    if (ps && ps.style.display !== 'flex') _origOpenPredictorScreen();
    return;
  }

  if (hash === '#dashboard') {
    const dash = document.getElementById('dashboard');
    if (dash && dash.style.display === 'flex') return; // already showing
    // checkStoredSession (overridden above) already handles restoration on load.
    // This branch handles back/forward navigation after initial load.
    let session = null;
    try { session = JSON.parse(localStorage.getItem('examSession')); } catch (e) {}
    
    const success = restoreSessionSilently(session, () => {
      _origShowDash(session.questions, true);
    });
    
    if (!success) {
      history.replaceState(null, '', location.pathname);
    }
    return;
  }

  if (hash === '#analysis') {
    const dash = document.getElementById('dashboard');
    if (dash && dash.style.display === 'flex') {
      _origOpenAnalysisScreen();
      return;
    }
    // Dashboard not open — restore first, then open analysis
    let session = null;
    try { session = JSON.parse(localStorage.getItem('examSession')); } catch (e) {}
    
    const success = restoreSessionSilently(session, () => {
      _origShowDash(session.questions, true);
      setTimeout(() => _origOpenAnalysisScreen(), 100);
    });
    
    if (!success) {
      history.replaceState(null, '', location.pathname);
    }
    return;
  }

  // Hash is empty → home. Close any open screen.
  const communityOpen = document.getElementById('communityScreen')?.style.display === 'flex';
  const predictorOpen = document.getElementById('predictorScreen')?.style.display === 'flex';
  const dashOpen      = document.getElementById('dashboard')?.style.display === 'flex';
  const analysisOpen  = document.getElementById('analysisScreen')?.style.display === 'flex';

  if (predictorOpen) _origClosePredictorScreen();
  else if (communityOpen) _origCloseCommunityScreen();
  else if (analysisOpen) _origCloseAnalysisScreen();
  else if (dashOpen) _origResetApp();
}

window.addEventListener('popstate', handleRoute);
