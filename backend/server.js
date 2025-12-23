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

// Security middleware
// CORS - allow requests from any origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Rate limiting - prevents abuse without tracking users
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  // NO user identification stored
  keyGenerator: (req) => {
    // Hash the IP so we can rate limit without storing actual IPs
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

/**
 * PRIVACY ARCHITECTURE:
 * 
 * 1. Images are received as multipart/form-data
 * 2. Stored ONLY in RAM via multer.memoryStorage()
 * 3. Converted to base64 for Claude API call
 * 4. Claude processes and returns structured data
 * 5. Buffer is dereferenced and garbage collected
 * 6. Response contains ONLY extracted purchase data
 * 
 * We NEVER:
 * - Write images to disk
 * - Store images in a database
 * - Log image contents or filenames
 * - Track which user uploaded what
 * - Keep any record of the transaction
 */

// Health check endpoint (no logging)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', privacy: 'enabled' });
});

/**
 * Receipt Scanning Endpoint
 * 
 * Accepts an image, extracts purchase data, returns JSON.
 * Image is NEVER stored - processed entirely in memory.
 */
app.post('/api/scan-receipt', upload.single('receipt'), async (req, res) => {
  // Immediate validation
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No image provided',
    });
  }

  try {
    // Convert buffer to base64 (still in memory only)
    const base64Image = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    // Call Claude Vision API
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

    // Parse Claude's response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format');
    }

    // Extract JSON from response (handles markdown code blocks)
    let jsonStr = content.text.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const extractedData = JSON.parse(jsonStr);

    // CRITICAL: Clear the buffer reference
    // Node's GC will clean up the actual memory
    req.file.buffer = null;

    // Return extracted data - NO image data included
    res.json({
      success: true,
      data: extractedData,
      // Include confidence indicators
      fieldsExtracted: Object.keys(extractedData).filter(k => extractedData[k] !== null).length,
      totalFields: Object.keys(extractedData).length,
    });

  } catch (error) {
    // Clear buffer even on error
    if (req.file) {
      req.file.buffer = null;
    }

    // Generic error - NO details logged
    res.status(500).json({
      success: false,
      error: 'Could not analyze receipt. Please try again or enter manually.',
      // Don't expose internal error details
    });
  }
});

/**
 * Stack Photo Analysis Endpoint
 * 
 * For analyzing photos of coin/bar stacks to identify and count items.
 * Same privacy guarantees as receipt scanning.
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

    // Clear buffer
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
 * Spot Price Endpoint
 * 
 * Returns current spot prices from a public API.
 * No user data involved.
 */
app.get('/api/spot-prices', async (req, res) => {
  try {
    // Use a public metals API (example - replace with actual provider)
    // This doesn't require any user data
    const response = await fetch('https://api.metals.live/v1/spot');
    const prices = await response.json();
    
    res.json({
      success: true,
      silver: prices.silver || null,
      gold: prices.gold || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Could not fetch spot prices',
    });
  }
});

// Error handler - NO detailed logging
app.use((err, req, res, next) => {
  // Clear any uploaded file buffer
  if (req.file) {
    req.file.buffer = null;
  }
  
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
});

module.exports = app;
