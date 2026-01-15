/**
 * Supabase Client Configuration
 *
 * Used for:
 * - ETF ratio calibration storage
 * - Minute-level price logging
 * - Historical price lookups
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Only initialize if credentials are configured
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client initialized');
} else {
  console.warn('Supabase credentials not configured - database features disabled');
}

/**
 * Check if Supabase is available
 */
function isSupabaseAvailable() {
  return supabase !== null;
}

/**
 * Get the Supabase client (may be null if not configured)
 */
function getSupabase() {
  return supabase;
}

module.exports = {
  supabase,
  isSupabaseAvailable,
  getSupabase
};
