# Bee Devices

Companion Android app for pairing physical devices with Bee Core.

## Stack

- Ionic + Angular
- Capacitor for native Android runtime
- ML Kit barcode scanning for QR pairing

## Bee Core integration

The first client targets `https://beecore.beeprojects.net/api` and follows the Connected Devices Phase A contract documented in Bee Core.

Pairing flow:

1. Scan the `bee-device://pair?token=...` QR payload created by Bee Core.
2. Exchange the one-time token with `POST /connected-devices/pair`.
3. Keep the returned device credential in memory while the device is pending.
4. Poll `GET /connected-devices/pairing-status` using `x-device-pairing-secret`.
5. Once approved, authenticate device operations with `Authorization: Bearer <credential>`.

The initial implementation deliberately does not persist the device credential. Secure Android Keystore-backed persistence will be added before production use.

## Development

Requirements: Node.js LTS, npm, Android Studio and Android SDK.

```bash
npm install
npm run start
```

To add the Android platform after installing dependencies:

```bash
npx cap add android
npm run build
npx cap sync android
npx cap open android
```

## Status

Initial application scaffold. Pairing API contract is aligned with the current Bee Core implementation. Native QR scanning and end-to-end pairing are the first MVP milestone.
