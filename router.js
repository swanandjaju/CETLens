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

// ─────────────────────────────────────────────────────────────────────────────
// PART 1: Wrap existing screen functions so they update the URL automatically
// ─────────────────────────────────────────────────────────────────────────────

// Dashboard (after upload)
const _origShowDash = showDash;
showDash = function (qs) {
  _origShowDash(qs);
  history.pushState(null, '', '#dashboard');
};

// Dashboard (restored from saved session)
const _origShowDashRestored = showDashRestored;
showDashRestored = function (qs) {
  _origShowDashRestored(qs);
  history.pushState(null, '', '#dashboard');
};

// Reset → back to home, clear hash
const _origResetApp = resetApp;
resetApp = function () {
  _origResetApp();
  history.pushState(null, '', location.pathname);
};

// Shift-wise Analysis → open
const _origOpenAnalysisScreen = openAnalysisScreen;
openAnalysisScreen = function () {
  _origOpenAnalysisScreen();
  history.pushState(null, '', '#analysis');
};

// Shift-wise Analysis → close (back button → dashboard)
const _origCloseAnalysisScreen = closeAnalysisScreen;
closeAnalysisScreen = function () {
  _origCloseAnalysisScreen();
  history.pushState(null, '', '#dashboard');
};

// Community → open
const _origOpenCommunityScreen = openCommunityScreen;
openCommunityScreen = function () {
  _origOpenCommunityScreen();
  history.pushState(null, '', '#community');
};

// Community → close (back button → home)
const _origCloseCommunityScreen = closeCommunityScreen;
closeCommunityScreen = function () {
  _origCloseCommunityScreen();
  history.pushState(null, '', location.pathname);
};


// ─────────────────────────────────────────────────────────────────────────────
// PART 2: Router — reads the hash and shows the correct screen
// Called on page load AND whenever the hash changes (browser back/forward)
// ─────────────────────────────────────────────────────────────────────────────

function handleRoute() {
  const hash = window.location.hash;

  // ── /#community ───────────────────────────────────────────────────────────
  // Works standalone, no session needed. Just open the screen.
  if (hash === '#community') {
    const cs = document.getElementById('communityScreen');
    if (cs && cs.style.display !== 'flex') {
      _origOpenCommunityScreen(); // use original to avoid double pushState
    }
    return;
  }

  // ── /#dashboard ───────────────────────────────────────────────────────────
  // Needs session data. If a session exists in localStorage, restore it.
  // If not, silently redirect to home.
  if (hash === '#dashboard') {
    const dash = document.getElementById('dashboard');
    if (dash && dash.style.display === 'flex') return; // already showing

    let session = null;
    try { session = JSON.parse(localStorage.getItem('examSession')); } catch (e) {}

    if (session && Array.isArray(session.questions) && session.questions.length) {
      // Restore state variables that script.js relies on
      questions       = session.questions;
      filteredQs      = session.questions;
      examMode        = session.stream   || 'PCM';
      selectedAttempt = session.attempt  || '';
      selectedShift   = session.shift    || '';

      const topbarFile = document.getElementById('topbarFile');
      if (topbarFile) topbarFile.textContent = session.fileName || 'Restored Session';

      _origShowDashRestored(session.questions);
    } else {
      // No session → go home
      history.replaceState(null, '', location.pathname);
    }
    return;
  }

  // ── /#analysis ────────────────────────────────────────────────────────────
  // Analysis is a sub-screen of dashboard. If someone lands here directly
  // (e.g. shared URL), restore the dashboard first, then open analysis on top.
  if (hash === '#analysis') {
    const dash = document.getElementById('dashboard');
    const alreadyOnDash = dash && dash.style.display === 'flex';

    if (alreadyOnDash) {
      _origOpenAnalysisScreen();
      return;
    }

    // Try to restore session, then open analysis on top
    let session = null;
    try { session = JSON.parse(localStorage.getItem('examSession')); } catch (e) {}

    if (session && Array.isArray(session.questions) && session.questions.length) {
      questions       = session.questions;
      filteredQs      = session.questions;
      examMode        = session.stream   || 'PCM';
      selectedAttempt = session.attempt  || '';
      selectedShift   = session.shift    || '';

      const topbarFile = document.getElementById('topbarFile');
      if (topbarFile) topbarFile.textContent = session.fileName || 'Restored Session';

      _origShowDashRestored(session.questions);
      // Small delay so the dashboard renders before analysis overlays it
      setTimeout(() => _origOpenAnalysisScreen(), 100);
    } else {
      // No session → go home
      history.replaceState(null, '', location.pathname);
    }
    return;
  }

  // ── / (home) ──────────────────────────────────────────────────────────────
  // If the hash is empty and some screen is open, close it back to home.
  const communityOpen = document.getElementById('communityScreen')?.style.display === 'flex';
  const dashOpen      = document.getElementById('dashboard')?.style.display === 'flex';
  const analysisOpen  = document.getElementById('analysisScreen')?.style.display === 'flex';

  if (communityOpen) _origCloseCommunityScreen();
  else if (analysisOpen) _origCloseAnalysisScreen();
  else if (dashOpen) _origResetApp();
  // else: already on home, nothing to do
}


// ─────────────────────────────────────────────────────────────────────────────
// PART 3: Wire it up
// ─────────────────────────────────────────────────────────────────────────────

// Browser back / forward buttons
window.addEventListener('popstate', handleRoute);

// On first page load, handle whatever hash is already in the URL
window.addEventListener('DOMContentLoaded', handleRoute);
