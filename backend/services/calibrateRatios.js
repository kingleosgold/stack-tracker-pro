/**
 * ETF Ratio Calibration Service
 *
 * Calibrates the conversion ratios between ETF prices (SLV, GLD)
 * and actual spot prices. This is done daily using live spot prices
 * from MetalPriceAPI as ground truth.
 *
 * The ratios drift over time due to ETF expense ratios (~0.5%/year)
 * so regular calibration ensures accurate conversions.
 */

const { supabase, isSupabaseAvailable } = require('../supabaseClient');
const { getCurrentETFQuotes, DEFAULT_SLV_RATIO, DEFAULT_GLD_RATIO } = require('./etfPrices');

// In-memory cache for today's ratios
let ratioCache = {
  date: null,
  slvRatio: DEFAULT_SLV_RATIO,
  gldRatio: DEFAULT_GLD_RATIO
};

/**
 * Calibrate ETF-to-spot ratios using current prices
 * Should be called once per day when we have fresh spot prices
 *
 * @param {number} currentGoldSpot - Current gold spot price (USD/oz)
 * @param {number} currentSilverSpot - Current silver spot price (USD/oz)
 * @returns {Object|null} The calculated ratios or null on error
 */
async function calibrateRatios(currentGoldSpot, currentSilverSpot) {
  try {
    // Get current ETF prices
    const quotes = await getCurrentETFQuotes();

    if (!quotes.slv || !quotes.gld) {
      console.error('Failed to fetch ETF quotes for calibration');
      return null;
    }

    const slvPrice = quotes.slv.price;
    const gldPrice = quotes.gld.price;

    // Calculate current ratios
    // ratio = ETF price / spot price
    const slvRatio = slvPrice / currentSilverSpot;
    const gldRatio = gldPrice / currentGoldSpot;

    const today = new Date().toISOString().split('T')[0];

    // Update in-memory cache
    ratioCache = {
      date: today,
      slvRatio,
      gldRatio
    };

    // Save to database if available
    if (isSupabaseAvailable()) {
      const { error } = await supabase
        .from('etf_ratios')
        .upsert({
          date: today,
          slv_ratio: slvRatio,
          gld_ratio: gldRatio,
          slv_price: slvPrice,
          gld_price: gldPrice,
          gold_spot: currentGoldSpot,
          silver_spot: currentSilverSpot,
          updated_at: new Date().toISOString()
        }, { onConflict: 'date' });

      if (error) {
        console.error('Error saving ETF ratios:', error);
      }
    }

    console.log(`Calibrated ratios for ${today}: SLV=${slvRatio.toFixed(4)}, GLD=${gldRatio.toFixed(4)}`);
    console.log(`  SLV: $${slvPrice.toFixed(2)} / Silver: $${currentSilverSpot.toFixed(2)}`);
    console.log(`  GLD: $${gldPrice.toFixed(2)} / Gold: $${currentGoldSpot.toFixed(2)}`);

    return { slvRatio, gldRatio, slvPrice, gldPrice };
  } catch (error) {
    console.error('Calibration error:', error);
    return null;
  }
}

/**
 * Get the calibrated ratio for a specific date
 * Falls back to default ratios if no data found
 *
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Object} Ratios for that date
 */
async function getRatioForDate(dateString) {
  // Check in-memory cache first
  if (ratioCache.date === dateString) {
    return {
      slv_ratio: ratioCache.slvRatio,
      gld_ratio: ratioCache.gldRatio
    };
  }

  // Try database if available
  if (isSupabaseAvailable()) {
    try {
      // Get the most recent ratio on or before the requested date
      const { data, error } = await supabase
        .from('etf_ratios')
        .select('*')
        .lte('date', dateString)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        return {
          slv_ratio: parseFloat(data.slv_ratio),
          gld_ratio: parseFloat(data.gld_ratio)
        };
      }
    } catch (err) {
      console.error('Error fetching ratio for date:', err.message);
    }
  }

  // Return defaults if nothing found
  return {
    slv_ratio: DEFAULT_SLV_RATIO,
    gld_ratio: DEFAULT_GLD_RATIO
  };
}

/**
 * Get the date of the last calibration
 * Used to determine if we need to recalibrate today
 */
async function getLastCalibrationDate() {
  // Check in-memory cache first
  if (ratioCache.date) {
    return ratioCache.date;
  }

  if (isSupabaseAvailable()) {
    try {
      const { data, error } = await supabase
        .from('etf_ratios')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        return data.date;
      }
    } catch (err) {
      console.error('Error getting last calibration date:', err.message);
    }
  }

  return null;
}

/**
 * Check if calibration is needed today
 */
async function needsCalibration() {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = await getLastCalibrationDate();
  return lastDate !== today;
}

/**
 * Get current cached ratios (for debugging/monitoring)
 */
function getCachedRatios() {
  return { ...ratioCache };
}

module.exports = {
  calibrateRatios,
  getRatioForDate,
  getLastCalibrationDate,
  needsCalibration,
  getCachedRatios
};
