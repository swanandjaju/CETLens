/* Supabase Percentile Data Collection */
(function () {
  var SUPABASE_URL = 'https://detploiolypvycwebvxu.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldHBsb2lvbHlwdnljd2Vidnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMjE0MTUsImV4cCI6MjA5Mzc5NzQxNX0.Zf05CQ6LNulCn9mEMRqIpyVAhAz1t-SNty8IbxuZNzg';

  window.submitPercentileData = async function (stream, attempt, shift, marks, percentile, hash) {
    try {
      var res = await fetch(SUPABASE_URL + '/rest/v1/marks_percentiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          stream: stream,
          attempt: attempt,
          shift: shift,
          marks: marks,
          percentile: parseFloat(percentile),
          hash: hash
        })
      });
      return res.ok;
    } catch (e) {
      console.error('Percentile submit failed:', e);
      return false;
    }
  };

  window.checkPercentileHash = async function(hash) {
    if (!hash) return false;
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_pct_hash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ p_hash: hash })
      });
      if (!response.ok) return false;
      const data = await response.json();
      return data === true;
    } catch (err) {
      console.error('Hash check error:', err);
      return false;
    }
  };
})();
