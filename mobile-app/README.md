# Stack Tracker Pro - Mobile App

Privacy-first precious metals portfolio tracker for iOS and Android.

## Features

- 📊 **Portfolio Tracking** - Track silver & gold holdings with real-time spot prices
- 📷 **AI Receipt Scanner** - Photograph receipts for automatic data entry
- 🔒 **Privacy-First** - All data stored locally with AES-256 encryption
- 👆 **Biometric Lock** - Face ID / Touch ID / Fingerprint protection
- 📈 **Numismatic Tracking** - Track collector premiums separately from melt value
- 📥 **CSV Export** - Export your complete portfolio for tax records
- 🔔 **Price Alerts** - Get notified when metals hit your targets

## Privacy Architecture

| What We Do | What We DON'T Do |
|------------|------------------|
| Store data locally on YOUR device | Store data on our servers |
| Encrypt with AES-256 | Send unencrypted data |
| Process receipt images in RAM only | Save receipt images anywhere |
| Use biometric authentication | Create user accounts |
| Delete images after scanning | Track or profile users |

## Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

### Development

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

### Testing Receipt Scanner

1. Deploy the backend API (see `stack-tracker-backend/` folder)
2. Update `API_BASE_URL` in App.js to point to your backend
3. Run the app and test scanning a receipt

## Building for App Stores

### Setup EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure
```

### Build for iOS

```bash
# Development build
eas build --platform ios --profile development

# Production build for App Store
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### Build for Android

```bash
# Development APK
eas build --platform android --profile development

# Production AAB for Google Play
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

## Project Structure

```
react-native-app/
├── App.js              # Main application component
├── app.json            # Expo configuration
├── package.json        # Dependencies
├── assets/             # App icons and splash screens
│   ├── icon.png        # App icon (1024x1024)
│   ├── splash.png      # Splash screen
│   ├── adaptive-icon.png # Android adaptive icon
│   └── favicon.png     # Web favicon
└── README.md           # This file
```

## Required Assets

Before building, create these images in the `assets/` folder:

- `icon.png` - 1024x1024 app icon
- `splash.png` - 1284x2778 splash screen  
- `adaptive-icon.png` - 1024x1024 Android foreground icon
- `favicon.png` - 32x32 web favicon

## API Configuration

Update `API_BASE_URL` in App.js to point to your deployed backend:

```javascript
const API_BASE_URL = 'https://api.yourdomain.com';
```

For local development:

```javascript
const API_BASE_URL = 'http://localhost:3000';
```

## App Store Submission Checklist

### iOS (App Store)

- [ ] Create App Store Connect listing
- [ ] Add app description emphasizing privacy
- [ ] Upload screenshots (6.5" and 5.5" iPhones)
- [ ] Set age rating (4+)
- [ ] Add privacy policy URL
- [ ] Fill out App Privacy section (minimal data collection)
- [ ] Submit for review

### Android (Google Play)

- [ ] Create Google Play Console listing
- [ ] Upload screenshots and feature graphic
- [ ] Fill out Data Safety section
- [ ] Set content rating
- [ ] Add privacy policy URL
- [ ] Submit for review

## Privacy Policy Requirements

Your privacy policy should emphasize:

1. **Local-first storage** - All portfolio data stays on device
2. **No accounts** - No user registration required
3. **Receipt processing** - Images processed in memory, never stored
4. **No tracking** - No analytics or user profiling
5. **Encryption** - AES-256 encryption for local data
6. **Export capability** - Users can export all their data
7. **Deletion** - Uninstalling removes all data

## Monetization (Optional)

The app supports a freemium model with in-app purchases:

| Feature | Free | Stacker ($4.99/mo) | Whale ($9.99/mo) |
|---------|------|-------------------|------------------|
| Manual entry | 10 items | Unlimited | Unlimited |
| Receipt scanning | ❌ | 5/month | Unlimited |
| Price alerts | 1 | 5 | Unlimited |
| CSV export | ❌ | ✅ | ✅ |
| Cloud sync | ❌ | ❌ | ✅ (E2E encrypted) |

To implement, add `expo-in-app-purchases` and create products in App Store Connect / Google Play Console.

## Support

- Email: support@stacktracker.app
- Privacy: privacy@stacktracker.app

## License

MIT
