/**
 * Escape external or user-controlled text before inserting it into an HTML
 * template. Prefer textContent when markup is not required.
 */
function sanitizeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Only allow image URL formats produced by the local PDF renderer.
 */
function sanitizeImageURL(value) {
  const url = String(value ?? '');
  if (url.startsWith('blob:')) return url;
  return /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(url) ? url : '';
}

let staticDataPromise = null;

/**
 * Load analytics snapshots only when an analytics or predictor view needs them.
 */
function loadStaticData() {
  if (Array.isArray(window.STATIC_SHIFT_STATS) &&
      Array.isArray(window.STATIC_SUBMISSION_SUMMARY)) {
    return Promise.resolve({
      shiftStats: window.STATIC_SHIFT_STATS,
      submissionSummary: window.STATIC_SUBMISSION_SUMMARY
    });
  }

  if (!staticDataPromise) {
    staticDataPromise = Promise.all([
      fetch('data/static_shift_stats.json', { cache: 'force-cache' }),
      fetch('data/static_submission_summary.json', { cache: 'force-cache' })
    ])
      .then(async ([statsResponse, summaryResponse]) => {
        if (!statsResponse.ok || !summaryResponse.ok) {
          throw new Error('Static analytics data could not be loaded.');
        }

        const [shiftStats, submissionSummary] = await Promise.all([
          statsResponse.json(),
          summaryResponse.json()
        ]);

        window.STATIC_SHIFT_STATS = Array.isArray(shiftStats) ? shiftStats : [];
        window.STATIC_SUBMISSION_SUMMARY =
          Array.isArray(submissionSummary) ? submissionSummary : [];

        return {
          shiftStats: window.STATIC_SHIFT_STATS,
          submissionSummary: window.STATIC_SUBMISSION_SUMMARY
        };
      })
      .catch(error => {
        staticDataPromise = null;
        throw error;
      });
  }

  return staticDataPromise;
}

window.APP_CONFIG = window.APP_CONFIG || {};
window.sanitizeHTML = sanitizeHTML;
window.sanitizeImageURL = sanitizeImageURL;
window.loadStaticData = loadStaticData;
