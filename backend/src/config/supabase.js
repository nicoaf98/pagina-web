const { createClient } = require('@supabase/supabase-js');

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

let cachedClient = null;

// Lazy: don't crash module load if env vars are missing. The image endpoints
// fail at request time with a clear 500 message; the rest of the app keeps
// working even when storage isn't configured (e.g. during local dev).
function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('SUPABASE_URL is not configured on the server');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server');

  cachedClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cachedClient;
}

module.exports = {
  getSupabaseClient,
  STORAGE_BUCKET,
};
