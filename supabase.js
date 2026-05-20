// ── Supabase Client Initialization ────────────────────────────────────────────
// Loaded via CDN: @supabase/supabase-js UMD bundle.
// The client is stored at window._supabaseClient for global access.

(function () {
  const SUPABASE_URL = 'https://detploiolypvycwebvxu.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldHBsb2lvbHlwdnljd2Vidnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMjE0MTUsImV4cCI6MjA5Mzc5NzQxNX0.Zf05CQ6LNulCn9mEMRqIpyVAhAz1t-SNty8IbxuZNzg';

  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[supabase.js] Supabase CDN not loaded — window.supabase is missing.');
    return;
  }

  window._supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  console.log('[supabase.js] Supabase client initialised.');
})();
