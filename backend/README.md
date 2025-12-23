# Stack Tracker Pro - Privacy-First Backend API

A backend API for the Stack Tracker Pro mobile app that processes receipt images using AI **without storing any user data**.

## Privacy Guarantees

| What We Do | What We DON'T Do |
|------------|------------------|
| Process images in RAM only | ❌ Write images to disk |
| Return extracted data immediately | ❌ Store images in databases |
| Hash IPs for rate limiting | ❌ Log actual IP addresses |
| Garbage collect after each request | ❌ Keep any transaction records |
| Use HTTPS encryption | ❌ Track users or create profiles |

## API Endpoints

### `POST /api/scan-receipt`
Upload a receipt image to extract purchase data.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `receipt` (image file - JPEG, PNG, WebP, or HEIC)
- Max size: 10MB

**Response:**
```json
{
  "success": true,
  "data": {
    "productName": "2023 American Silver Eagle 1 oz BU",
    "source": "APMEX",
    "datePurchased": "2024-01-15",
    "metal": "silver",
    "ozt": 1,
    "quantity": 10,
    "unitPrice": 29.99,
    "taxes": 0,
    "shipping": 9.95,
    "spotPrice": 23.50,
    "orderNumber": "12345678",
    "notes": "Tube of 10"
  },
  "fieldsExtracted": 11,
  "totalFields": 12
}
```

### `POST /api/analyze-stack`
Upload a photo of your stack to identify coins/bars and estimate counts.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `stack` (image file)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productName": "American Silver Eagle",
        "metal": "silver",
        "ozt": 1,
        "estimatedCount": 20,
        "confidence": "high",
        "notes": "Mixed years, BU condition"
      }
    ],
    "totalSilverOzt": 20,
    "totalGoldOzt": 0,
    "analysisNotes": "Stack appears to be primarily government-minted silver bullion"
  }
}
```

### `GET /api/spot-prices`
Get current spot prices (no user data required).

**Response:**
```json
{
  "success": true,
  "silver": 23.45,
  "gold": 2045.30,
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### `GET /api/health`
Health check endpoint.

## Deployment

### Environment Variables
```
ANTHROPIC_API_KEY=your-api-key-here
PORT=3000
```

### Docker
```bash
docker build -t stack-tracker-api .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=your-key stack-tracker-api
```

### Direct
```bash
npm install
ANTHROPIC_API_KEY=your-key npm start
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App                                │
│                   (React Native / Flutter)                       │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │ Local Database  │    │ Receipt Scanner │    │  Portfolio   │ │
│  │ (SQLite/Realm)  │    │    (Camera)     │    │    Views     │ │
│  └────────┬────────┘    └────────┬────────┘    └──────────────┘ │
│           │                      │                               │
│           │              ┌───────┴───────┐                       │
│           │              │  Upload Image │                       │
│           │              └───────┬───────┘                       │
└───────────┼──────────────────────┼───────────────────────────────┘
            │                      │
            │                      │ HTTPS (encrypted)
            │                      │
            │              ┌───────▼───────┐
            │              │   API Server  │
            │              │               │
            │              │ ┌───────────┐ │
            │              │ │  Memory   │ │
            │              │ │   Only    │ │  ← Image never hits disk
            │              │ └─────┬─────┘ │
            │              │       │       │
            │              │ ┌─────▼─────┐ │
            │              │ │  Claude   │ │
            │              │ │  Vision   │ │
            │              │ └─────┬─────┘ │
            │              │       │       │
            │              │ ┌─────▼─────┐ │
            │              │ │   JSON    │ │
            │              │ │ Response  │ │
            │              │ └───────────┘ │
            │              └───────┬───────┘
            │                      │
            │              ┌───────▼───────┐
            │              │ Extracted Data│
            │              │   (no image)  │
            │              └───────┬───────┘
            │                      │
            ▼                      ▼
┌───────────────────────────────────────────────────────────────────┐
│                      User's Device Only                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Encrypted Local DB                        │ │
│  │                                                              │ │
│  │   Holdings    │    Purchases    │    Price Alerts           │ │
│  │   - Silver    │    - Date       │    - Target Price         │ │
│  │   - Gold      │    - Dealer     │    - Notification         │ │
│  │   - Premium   │    - Amount     │                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ⚠️  Data NEVER leaves device except for optional encrypted sync │
└───────────────────────────────────────────────────────────────────┘
```

## Security Features

1. **Helmet.js** - Sets security headers
2. **Rate Limiting** - Prevents abuse (hashed IPs, not stored)
3. **File Type Validation** - Only allows image formats
4. **Size Limits** - 10MB max per upload
5. **Memory-Only Storage** - No disk writes
6. **Non-Root Container** - Runs as unprivileged user
7. **No Logging** - No request/response logging

## Mobile App Integration

### React Native Example
```javascript
const scanReceipt = async (imageUri) => {
  const formData = new FormData();
  formData.append('receipt', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'receipt.jpg',
  });

  const response = await fetch('https://api.stacktracker.app/api/scan-receipt', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  
  if (result.success) {
    // Auto-fill form with extracted data
    setFormData(result.data);
  }
};
```

### Flutter Example
```dart
Future<Map<String, dynamic>> scanReceipt(File imageFile) async {
  var request = http.MultipartRequest(
    'POST',
    Uri.parse('https://api.stacktracker.app/api/scan-receipt'),
  );
  
  request.files.add(await http.MultipartFile.fromPath('receipt', imageFile.path));
  
  var response = await request.send();
  var responseBody = await response.stream.bytesToString();
  
  return json.decode(responseBody);
}
```

## License

MIT
