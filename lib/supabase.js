const { createClient } = require('@supabase/supabase-js');

function storageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || 'resumes';
}

function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

module.exports = {
  getServiceClient: getServiceClient,
  storageBucket: storageBucket
};
