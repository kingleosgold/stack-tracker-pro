/**
 * Stack Tracker Pro - Privacy-First Backend API
 * 
 * This server handles AI receipt scanning WITHOUT storing any user data.
 * Images are processed in memory and immediately discarded.
 * No logs, no analytics, no tracking.
 */

const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// CORS - allow requests from any origin (mobile app, web preview, etc.)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Rate limiting - prevents abuse without tracking users
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return crypto.createHash('sha256').update(req.ip).digest('hex').slice(0, 16);
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
    });
  },
});
app.use('/api/', limiter);

// Memory-only file upload - NEVER touches disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, HEIC'));
    }
  },
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// HISTORICAL PRICE DATA CACHE
// ============================================

// Cache for current spot prices (refresh every 5 minutes)
let spotPriceCache = {
  silver: 30.50,
  gold: 2650.00,
  timestamp: null,
};

// Cache for historical gold prices from freegoldapi.com
let historicalGoldPrices = {}; // { "2024-04-19": 2391.50, ... }
let historicalGoldSilverRatio = {}; // { "2024-04-19": 84.5, ... }
let historicalDataLoaded = false;

/**
 * Load historical gold prices from freegoldapi.com
 * This data is free, CORS-enabled, no API key required
 */
async function loadHistoricalData() {
  try {
    console.log('Loading historical gold prices from freegoldapi.com...');
    
    // Fetch gold prices (daily data from 1960+)
    const goldResponse = await fetch('https://freegoldapi.com/data/latest.json');
    if (goldResponse.ok) {
      const goldData = await goldResponse.json();
      
      // Build lookup map by date
      goldData.forEach(record => {
        if (record.date && record.price) {
          historicalGoldPrices[record.date] = parseFloat(record.price);
        }
      });
      
      console.log(`Loaded ${Object.keys(historicalGoldPrices).length} gold price records`);
    }

    // Fetch gold/silver ratio data to calculate silver prices
    // Try JSON first, fall back to CSV
    try {
      const ratioResponse = await fetch('https://freegoldapi.com/data/gold_silver_ratio_enriched.csv');
      if (ratioResponse.ok) {
        const csvText = await ratioResponse.text();
        const lines = csvText.split('\n');
        
        // Skip header, parse data
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          if (parts.length >= 2) {
            const date = parts[0].trim();
            const ratio = parseFloat(parts[parts.length - 1]); // Last column is ratio
            if (date && !isNaN(ratio) && ratio > 0) {
              historicalGoldSilverRatio[date] = ratio;
            }
          }
        }
        
        console.log(`Loaded ${Object.keys(historicalGoldSilverRatio).length} gold/silver ratio records`);
      }
    } catch (e) {
      console.log('Could not load ratio data, will estimate silver prices');
    }

    historicalDataLoaded = true;
    console.log('Historical data loaded successfully!');
    
  } catch (error) {
    console.log('Could not load historical data from freegoldapi.com:', error.message);
    historicalDataLoaded = false;
  }
}

/**
 * Get historical spot price for a specific date
 * Uses exact daily data when available, interpolates when not
 */
function getHistoricalPrice(date, metal) {
  const metalType = (metal || 'silver').toLowerCase();
  
  // Try exact date first for gold
  if (metalType === 'gold' && historicalGoldPrices[date]) {
    return {
      price: historicalGoldPrices[date],
      source: 'exact',
      note: 'Exact daily price from freegoldapi.com'
    };
  }
  
  // For silver, calculate from gold and ratio
  if (metalType === 'silver') {
    const goldPrice = historicalGoldPrices[date];
    const ratio = historicalGoldSilverRatio[date];
    
    if (goldPrice && ratio) {
      return {
        price: parseFloat((goldPrice / ratio).toFixed(2)),
        source: 'exact',
        note: 'Calculated from exact gold price and gold/silver ratio'
      };
    }
    
    // Try to find gold price and use nearest ratio
    if (goldPrice) {
      const nearestRatio = findNearestValue(historicalGoldSilverRatio, date);
      if (nearestRatio) {
        return {
          price: parseFloat((goldPrice / nearestRatio.value).toFixed(2)),
          source: 'interpolated',
          note: `Gold price exact, ratio from ${nearestRatio.date}`
        };
      }
      
      // Use typical ratio of ~80 as fallback
      return {
        price: parseFloat((goldPrice / 80).toFixed(2)),
        source: 'estimated',
        note: 'Calculated from gold price with estimated ratio'
      };
    }
  }
  
  // Try to find nearest date for gold
  if (metalType === 'gold') {
    const nearest = findNearestValue(historicalGoldPrices, date);
    if (nearest) {
      return {
        price: nearest.value,
        source: 'nearest',
        note: `Nearest available date: ${nearest.date}`
      };
    }
  }
  
  // For silver, try nearest gold and calculate
  if (metalType === 'silver') {
    const nearestGold = findNearestValue(historicalGoldPrices, date);
    const nearestRatio = findNearestValue(historicalGoldSilverRatio, date);
    
    if (nearestGold) {
      const ratioToUse = nearestRatio ? nearestRatio.value : 80;
      return {
        price: parseFloat((nearestGold.value / ratioToUse).toFixed(2)),
        source: 'interpolated',
        note: `Estimated from ${nearestGold.date} gold price`
      };
    }
  }
  
  // Ultimate fallback - current cache price
  return {
    price: metalType === 'silver' ? spotPriceCache.silver : spotPriceCache.gold,
    source: 'fallback',
    note: 'Historical data unavailable - using current price'
  };
}

/**
 * Find the nearest value in a date-keyed object
 */
function findNearestValue(dataObj, targetDate) {
  const dates = Object.keys(dataObj).sort();
  if (dates.length === 0) return null;
  
  const target = new Date(targetDate).getTime();
  let closest = null;
  let closestDiff = Infinity;
  
  for (const date of dates) {
    const diff = Math.abs(new Date(date).getTime() - target);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = { date, value: dataObj[date] };
    }
  }
  
  // Only use if within 30 days
  if (closestDiff <= 30 * 24 * 60 * 60 * 1000) {
    return closest;
  }
  
  return null;
}

// Load historical data on startup
loadHistoricalData();

// Refresh historical data every 24 hours
setInterval(loadHistoricalData, 24 * 60 * 60 * 1000);

// ============================================
// API ENDPOINTS
// ============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    privacy: 'enabled',
    historicalDataLoaded,
    goldRecords: Object.keys(historicalGoldPrices).length,
    ratioRecords: Object.keys(historicalGoldSilverRatio).length,
  });
});

/**
 * Receipt Scanning Endpoint
 */
app.post('/api/scan-receipt', upload.single('receipt'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image provided',
    });
  }

  try {
    const base64Image = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analyze this precious metals purchase receipt/screenshot and extract the following data. Return ONLY a JSON object with these fields (use null for any field you cannot determine):

{
  "productName": "Full product name (e.g., '2023 American Silver Eagle 1 oz BU')",
  "source": "Dealer name (e.g., 'APMEX', 'JM Bullion', 'SD Bullion')",
  "datePurchased": "Date in YYYY-MM-DD format",
  "metal": "silver" or "gold",
  "ozt": "Troy ounces per unit as a number",
  "quantity": "Number of items as an integer",
  "unitPrice": "Price per unit as a number (no $ symbol)",
  "taxes": "Tax amount as a number (0 if none)",
  "shipping": "Shipping cost as a number (0 if none)",
  "spotPrice": "Spot price at time of purchase if shown, otherwise null",
  "orderNumber": "Order/invoice number if visible",
  "notes": "Any handwritten notes or relevant details"
}

Important:
- Extract data from receipts, packing slips, order confirmations, or screenshots
- Read handwritten notes if present
- For stack photos (not receipts), identify the coins/bars and estimate quantities
- Return ONLY valid JSON, no additional text`,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format');
    }

    let jsonStr = content.text.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const extractedData = JSON.parse(jsonStr);

    // Clear buffer
    req.file.buffer = null;

    res.json({
      success: true,
      data: extractedData,
      fieldsExtracted: Object.keys(extractedData).filter(k => extractedData[k] !== null).length,
      totalFields: Object.keys(extractedData).length,
    });

  } catch (error) {
    if (req.file) req.file.buffer = null;
    res.status(500).json({
      success: false,
      error: 'Could not analyze receipt. Please try again or enter manually.',
    });
  }
});

/**
 * Stack Photo Analysis Endpoint
 */
app.post('/api/analyze-stack', upload.single('stack'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image provided',
    });
  }

  try {
    const base64Image = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analyze this photo of precious metals (coins, bars, rounds) and identify what you see. Return ONLY a JSON object:

{
  "items": [
    {
      "productName": "Identified product (e.g., 'American Silver Eagle')",
      "metal": "silver" or "gold",
      "ozt": "Troy ounces per piece",
      "estimatedCount": "How many you can see/count",
      "confidence": "high", "medium", or "low",
      "notes": "Any identifying features (year, mint mark, condition)"
    }
  ],
  "totalSilverOzt": "Estimated total silver troy ounces",
  "totalGoldOzt": "Estimated total gold troy ounces",
  "analysisNotes": "General observations about the stack"
}

Be conservative with counts - only count what you can clearly see.`,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    let jsonStr = content.text.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const analysisData = JSON.parse(jsonStr);
    req.file.buffer = null;

    res.json({
      success: true,
      data: analysisData,
    });

  } catch (error) {
    if (req.file) req.file.buffer = null;
    res.status(500).json({
      success: false,
      error: 'Could not analyze stack photo. Please try again.',
    });
  }
});

/**
 * Current Spot Price Endpoint
 * Fetches live spot prices from multiple sources with fallback
 */
app.get('/api/spot-prices', async (req, res) => {
  // Check cache (5 minute TTL)
  const now = Date.now();
  if (spotPriceCache.timestamp && (now - spotPriceCache.timestamp) < 5 * 60 * 1000) {
    return res.json({
      success: true,
      silver: spotPriceCache.silver,
      gold: spotPriceCache.gold,
      timestamp: new Date(spotPriceCache.timestamp).toISOString(),
      cached: true,
    });
  }

  try {
    // Try metals.live API first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://api.metals.live/v1/spot', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      const prices = await response.json();
      
      let silver = null;
      let gold = null;
      
      if (Array.isArray(prices)) {
        const silverData = prices.find(p => p.metal === 'silver');
        const goldData = prices.find(p => p.metal === 'gold');
        silver = silverData?.price || null;
        gold = goldData?.price || null;
      } else {
        silver = prices.silver || null;
        gold = prices.gold || null;
      }

      if (silver && gold) {
        spotPriceCache = { silver, gold, timestamp: now };
        return res.json({
          success: true,
          silver,
          gold,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.log('Primary spot price API failed, using cache');
  }

  // Fallback: Use cached/default values
  res.json({
    success: true,
    silver: spotPriceCache.silver,
    gold: spotPriceCache.gold,
    timestamp: new Date().toISOString(),
    cached: true,
    note: 'Using cached prices - live API temporarily unavailable',
  });
});

/**
 * Historical Spot Price Endpoint
 * Returns exact daily spot price for a given date
 */
app.get('/api/historical-spot', (req, res) => {
  const { date, metal } = req.query;

  if (!date) {
    return res.status(400).json({
      success: false,
      error: 'Date parameter required (YYYY-MM-DD format)',
    });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid date format. Use YYYY-MM-DD',
    });
  }

  const metalType = (metal || 'silver').toLowerCase();
  if (!['silver', 'gold'].includes(metalType)) {
    return res.status(400).json({
      success: false,
      error: 'Metal must be "silver" or "gold"',
    });
  }

  const result = getHistoricalPrice(date, metalType);

  res.json({
    success: true,
    date,
    metal: metalType,
    price: result.price,
    source: result.source,
    note: result.note,
  });
});

/**
 * Bulk Historical Prices Endpoint
 * Returns prices for multiple dates at once
 */
app.post('/api/historical-spot/bulk', express.json(), (req, res) => {
  const { dates, metal } = req.body;

  if (!dates || !Array.isArray(dates)) {
    return res.status(400).json({
      success: false,
      error: 'dates array required',
    });
  }

  const metalType = (metal || 'silver').toLowerCase();
  const results = {};

  for (const date of dates.slice(0, 100)) { // Limit to 100 dates
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const result = getHistoricalPrice(date, metalType);
      results[date] = result.price;
    }
  }

  res.json({
    success: true,
    metal: metalType,
    prices: results,
  });
});

// Error handler
app.use((err, req, res, next) => {
  if (req.file) req.file.buffer = null;
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An error occurred',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Stack Tracker API running on port ${PORT}`);
  console.log('Privacy mode: ENABLED');
  console.log('Image storage: DISABLED (memory-only processing)');
  console.log('User tracking: DISABLED');
  console.log('Historical prices: Loading from freegoldapi.com...');
});

module.exports = app;
