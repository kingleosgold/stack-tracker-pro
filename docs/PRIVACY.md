# Privacy Policy

**Last Updated: December 2025**

## Our Commitment

Stack Tracker Pro is built on a simple principle: **your data is yours alone**.

We don't want your data. We don't need your data. We've architected our system so we *can't* access your data, even if we wanted to.

## What Data We Collect

**None.**

We do not collect, store, or process any personal information or portfolio data.

## How the App Works

### Local Storage
All your portfolio data (holdings, purchases, alerts, preferences) is stored exclusively on your device. We never see it, we never transmit it, we never have access to it.

### Receipt Scanning
When you scan a receipt:
1. Your image is transmitted over encrypted HTTPS to our server
2. The image is held in server RAM only (never written to disk)
3. AI analyzes the image and extracts purchase data
4. Only the extracted text data (product name, price, etc.) is returned to your device
5. The image is immediately garbage collected from memory
6. No record of the transaction exists on our servers

**We cannot recover, reproduce, or access any receipt image after processing.**

### Spot Prices
When fetching spot prices, we make anonymous requests to public metals APIs. No user identification is included.

## What We Don't Do

- ❌ Create user accounts
- ❌ Store your portfolio data
- ❌ Store your receipt images
- ❌ Track your app usage
- ❌ Use analytics SDKs
- ❌ Sell or share any data
- ❌ Show advertisements
- ❌ Create user profiles

## Third-Party Services

### AI Processing (Anthropic)
Receipt images are processed using Anthropic's Claude AI. Anthropic's privacy policy applies during image analysis. Anthropic does not use API data for training by default.

### Spot Price APIs
We fetch prices from public metals APIs. These requests contain no user information.

## Data Retention

| Data Type | Location | Retention |
|-----------|----------|-----------|
| Portfolio Data | Your device | Until you delete |
| Receipt Images | Server RAM | < 30 seconds |
| Usage Analytics | N/A | Not collected |
| User Accounts | N/A | Not collected |

## Your Rights

- **Access**: All your data is on your device. You have complete access.
- **Export**: Export your portfolio to CSV at any time.
- **Delete**: Uninstall the app to delete all data. It's that simple.

## Optional Cloud Sync

If you enable cloud sync (Whale tier), your data is:
- Encrypted on your device with a key derived from your password
- Transmitted as an encrypted blob
- Stored encrypted on our servers
- **We cannot decrypt it** — we never have your password or encryption key

If you forget your password, your cloud data is unrecoverable. This is by design.

## Legal Requests

We cannot comply with requests for user data because we don't have any. Our architecture makes it technically impossible for us to provide:
- User holdings information
- Purchase history
- Receipt images
- User identification

This isn't a policy — it's a technical reality.

## Children's Privacy

Stack Tracker Pro does not knowingly collect any information from children under 13.

## Changes to This Policy

We will notify users of material changes through the app. Our commitment to privacy will never weaken — changes will only strengthen our protections.

## Contact

Questions about privacy? Contact us at privacy@stacktracker.app

---

**Stack safe. Stack private.**
