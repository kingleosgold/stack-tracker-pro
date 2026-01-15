/**
 * Price Logger Service
 *
 * Logs every spot price fetch to build our own minute-level
 * historical dataset. Over time, this gives us high-granularity
 * price data for accurate historical lookups.
 */

const { supabase, isSupabaseAvailable } = require('../supabaseClient');

/**
 * Log a price fetch to the database
 *
 * @param {Object} prices - Price data
 * @param {number} prices.gold - Gold price (USD/oz)
 * @param {number} prices.silver - Silver price (USD/oz)
 * @param {number} [prices.platinum] - Platinum price (USD/oz)
 * @param {number} [prices.palladium] - Palladium price (USD/oz)
 * @param {string} [source='metalpriceapi'] - Source of the price data
 */
async function logPriceFetch(prices, source = 'metalpriceapi') {
  if (!isSupabaseAvailable()) {
    return; // Silently skip if Supabase not configured
  }

  if (!prices || !prices.gold || !prices.silver) {
    console.warn('Invalid prices for logging:', prices);
    return;
  }

  try {
    const { error } = await supabase
      .from('price_log')
      .insert({
        timestamp: new Date().toISOString(),
        gold_price: prices.gold,
        silver_price: prices.silver,
        platinum_price: prices.platinum || null,
        palladium_price: prices.palladium || null,
        source: source
      });

    if (error) {
      console.error('Error logging price:', error);
    }
  } catch (err) {
    console.error('Price logging failed:', err.message);
  }
}

/**
 * Look up a logged price near a specific timestamp
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} [timeString] - Time in HH:MM format (optional)
 * @param {number} [windowMinutes=5] - Time window in minutes
 * @returns {Object|null} Logged price data or null
 */
async function findLoggedPrice(dateString, timeString = null, windowMinutes = 5) {
  if (!isSupabaseAvailable()) {
    return null;
  }

  try {
    let timestamp;
    if (timeString) {
      timestamp = new Date(`${dateString}T${timeString}:00`);
    } else {
      // Default to midday if no time specified
      timestamp = new Date(`${dateString}T12:00:00`);
      windowMinutes = 720; // 12 hours - get any price from that day
    }

    const windowStart = new Date(timestamp.getTime() - windowMinutes * 60 * 1000);
    const windowEnd = new Date(timestamp.getTime() + windowMinutes * 60 * 1000);

    const { data, error } = await supabase
      .from('price_log')
      .select('*')
      .gte('timestamp', windowStart.toISOString())
      .lte('timestamp', windowEnd.toISOString())
      .order('timestamp')
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      gold: parseFloat(data.gold_price),
      silver: parseFloat(data.silver_price),
      platinum: data.platinum_price ? parseFloat(data.platinum_price) : null,
      palladium: data.palladium_price ? parseFloat(data.palladium_price) : null,
      timestamp: data.timestamp,
      source: data.source
    };
  } catch (err) {
    console.error('Error finding logged price:', err.message);
    return null;
  }
}

/**
 * Find the closest logged price to a timestamp (any time window)
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} [timeString] - Time in HH:MM format
 * @returns {Object|null} Closest logged price
 */
async function findClosestLoggedPrice(dateString, timeString = null) {
  if (!isSupabaseAvailable()) {
    return null;
  }

  try {
    let timestamp;
    if (timeString) {
      timestamp = new Date(`${dateString}T${timeString}:00`);
    } else {
      timestamp = new Date(`${dateString}T12:00:00`);
    }

    // Search within the same day
    const dayStart = new Date(`${dateString}T00:00:00`);
    const dayEnd = new Date(`${dateString}T23:59:59`);

    const { data, error } = await supabase
      .from('price_log')
      .select('*')
      .gte('timestamp', dayStart.toISOString())
      .lte('timestamp', dayEnd.toISOString())
      .order('timestamp');

    if (error || !data || data.length === 0) {
      return null;
    }

    // Find the closest timestamp
    let closest = data[0];
    let closestDiff = Math.abs(new Date(data[0].timestamp) - timestamp);

    for (const entry of data) {
      const diff = Math.abs(new Date(entry.timestamp) - timestamp);
      if (diff < closestDiff) {
        closest = entry;
        closestDiff = diff;
      }
    }

    return {
      gold: parseFloat(closest.gold_price),
      silver: parseFloat(closest.silver_price),
      platinum: closest.platinum_price ? parseFloat(closest.platinum_price) : null,
      palladium: closest.palladium_price ? parseFloat(closest.palladium_price) : null,
      timestamp: closest.timestamp,
      source: closest.source,
      timeDiffMinutes: Math.round(closestDiff / 60000)
    };
  } catch (err) {
    console.error('Error finding closest price:', err.message);
    return null;
  }
}

/**
 * Get statistics about our logged price data
 */
async function getLogStats() {
  if (!isSupabaseAvailable()) {
    return { available: false };
  }

  try {
    // Get count
    const { count, error: countError } = await supabase
      .from('price_log')
      .select('*', { count: 'exact', head: true });

    // Get date range
    const { data: oldest } = await supabase
      .from('price_log')
      .select('timestamp')
      .order('timestamp', { ascending: true })
      .limit(1)
      .single();

    const { data: newest } = await supabase
      .from('price_log')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return {
      available: true,
      totalEntries: count || 0,
      oldestEntry: oldest?.timestamp || null,
      newestEntry: newest?.timestamp || null
    };
  } catch (err) {
    console.error('Error getting log stats:', err.message);
    return { available: true, error: err.message };
  }
}

module.exports = {
  logPriceFetch,
  findLoggedPrice,
  findClosestLoggedPrice,
  getLogStats
};
