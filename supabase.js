// ── Supabase Client Initialization ────────────────────────────────────────────
// Loaded via CDN: @supabase/supabase-js UMD bundle.
// The client is stored at window._supabaseClient for global access.

(function () {
  const SUPABASE_URL  = 'https://detploiolypvcwebvxu.supabase.co';
  const SUPABASE_ANON = 'sb_publishable_iUL7FfiSzoWWI9QrwPuShg_aaAPgR6s';

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[supabase.js] Supabase CDN not loaded — window.supabase is missing.');
    return;
  }

  window._supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  console.log('[supabase.js] Supabase client initialised.');
})();
