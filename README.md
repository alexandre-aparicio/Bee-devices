# Bee Devices

Companion Android app for pairing physical devices with Bee Core.

## Stack

- Ionic + Angular
- Capacitor for native Android runtime
- ML Kit barcode scanning for QR pairing
- Native Android credential storage backed by Android Keystore (AES-256-GCM)

## Bee Core integration

The first client targets `https://beecore.beeprojects.net/api` and follows the Connected Devices Phase A contract documented in Bee Core.

Pairing flow:

1. Scan the `bee-device://pair?token=...` QR payload created by Bee Core.
2. Exchange the one-time token with `POST /connected-devices/pair`.
3. Encrypt and persist the returned device credential using an AES key generated inside Android Keystore.
4. Poll `GET /connected-devices/pairing-status` using `x-device-pairing-secret`.
5. On app start and resume, decrypt the credential and ask Bee Core for the current approval state.
6. Once active, authenticate device operations with `Authorization: Bearer <credential>`.

The credential is never written to WebView storage or plaintext preferences. Android stores only the AES-GCM ciphertext and IV in private app preferences; the encryption key is non-exportable and held by Android Keystore. Android backup is disabled so app-private credential data is not migrated as a restorable backup.

### Lifecycle and reinstall policy

- Closing the app, Android reclaiming its process, and restarting or powering off the phone do not remove the pairing.
- The app checks the server state again when it starts or returns to the foreground. A local credential never overrides a revoked, suspended, expired or otherwise inactive server state.
- Temporary network failures do not erase the credential; the app retries when connectivity returns or the app resumes.
- **Uninstalling Bee Devices removes its local credential. Reinstalling requires a completely new QR pairing and administrator approval.** There is no credential recovery or migration flow.
- The app does not run a permanent background service. Heartbeats are sent when the user requests a connection check; continuous background operation is a separate feature.

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

The native `MainActivity` and secure-storage plugin are included under `android/app/src/main/java/net/beeprojects/devices`. If regenerating the Android platform, restore these native files and the manifest changes before building.

## Status

Android secure persistence implementation. Physical-device validation is required for encryption, process restart, phone restart, server revocation and uninstall/reinstall behaviour.
