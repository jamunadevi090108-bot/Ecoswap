const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function isPlaceholder(value) {
  return !value || /(^|[/:_-])(your|replace|example)([/:_-]|$)|</i.test(value);
}

const supabaseUrlIsValid = /^https:\/\/.+\.supabase\.co\/?$/i.test(supabaseUrl) && !isPlaceholder(supabaseUrl);
const serviceRoleKeyIsPresent = !isPlaceholder(serviceRoleKey);
const isSupabaseConfigured = supabaseUrlIsValid && serviceRoleKeyIsPresent;

function supabaseConfigurationMessage() {
  const missing = [];
  if (!supabaseUrlIsValid) missing.push('SUPABASE_URL');
  if (!serviceRoleKeyIsPresent) missing.push('SUPABASE_SERVICE_ROLE_KEY (the private service_role secret, not the project URL or publishable/anon key)');
  return `Supabase is not configured. Set ${missing.join(' and ')} in backend/.env.`;
}

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(supabaseConfigurationMessage());
    this.name = 'SupabaseNotConfiguredError';
  }
}

function getSupabase() {
  if (!supabase) throw new SupabaseNotConfiguredError();
  return supabase;
}

function normalizeRow(row) {
  if (!row) return null;
  return { ...row, id: row.id, _id: row.id };
}

function isUuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function sendSupabaseError(res, error) {
  if (error instanceof SupabaseNotConfiguredError) {
    return res.status(503).json({ message: error.message });
  }

  if (['22P02', '22007', '22001', '22023', '23514'].includes(error?.code)) {
    return res.status(400).json({ message: 'Invalid data supplied.' });
  }
  if (error?.code === 'P0002') {
    return res.status(404).json({ message: 'The requested record was not found.' });
  }
  if (error?.code === 'P0001') {
    return res.status(409).json({ message: 'This product is no longer available.' });
  }
  if (error?.code === '23505') {
    return res.status(409).json({ message: 'A record with these details already exists.' });
  }
  if (error?.code === '23503') {
    return res.status(400).json({ message: 'The requested related record does not exist.' });
  }

  console.error(`[Supabase] ${error?.code || 'query-error'}: ${error?.message || 'Database operation failed.'}`);
  return res.status(500).json({ message: 'Database operation failed. Check the backend logs and Supabase setup.' });
}

module.exports = {
  getSupabase,
  isSupabaseConfigured,
  supabaseConfigurationMessage,
  isUuid,
  normalizeRow,
  sendSupabaseError
};
