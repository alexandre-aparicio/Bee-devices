# Connected Devices pairing — functional validation

**Validation date:** 2026-11-28  
**Status:** Functional end-to-end pairing confirmed by the project owner.

## Environment

- Android companion repository: [Bee-devices](https://github.com/alexandre-aparicio/Bee-devices)
- Target branch: `main`
- Physical Android device used for installation: ADB serial `5baac27`
- Bee-Core backend: `main`, deployed on the project VPS
- Installation type: Android debug APK, updated over the existing installation with `adb install -r`

## Confirmed end-to-end flow

1. Enable pairing in Bee-Core.
2. Display the QR challenge in Bee-Core.
3. Scan the QR from Bee-devices on Android.
4. Android submits the pairing request.
5. Bee-Core closes the QR modal and shows the device as pending manual approval.
6. An administrator approves the device and its requested capabilities in Bee-Core.
7. Android polls the pairing status and receives the transition from `pending` to `active`.
8. Android displays the paired state and the capability badges returned by Bee-Core.

The owner confirmed that this flow works against the VPS after installing the updated Android build.

## Changes included in main

- [PR #6](https://github.com/alexandre-aparicio/Bee-devices/pull/6): pairing request lifecycle, pending state, polling and persisted session restoration.
- [PR #7](https://github.com/alexandre-aparicio/Bee-devices/pull/7): support for the pairing credential fields returned by the backend.
- [PR #8](https://github.com/alexandre-aparicio/Bee-devices/pull/8): run pairing approval UI updates inside Angular's `NgZone` and trigger change detection after status updates.

PR #8 was merged as commit `4900e2641951b7d44d90226167bd2a649033e57c`. Its [GitHub Actions run](https://github.com/alexandre-aparicio/Bee-devices/actions/runs/46140628453) completed the Angular build, Capacitor Android sync and Android debug APK build successfully.

## Device update procedure

The repeatable one-block PowerShell procedure is documented in [ANDROID-DEVICE-UPDATE.md](./ANDROID-DEVICE-UPDATE.md). It updates `main`, builds the web app, syncs Capacitor, builds the debug APK and installs it on ADB device `5baac27`.

## Scope of this validation

**Confirmed:**
- QR scanning and pairing request submission.
- Pending request displayed in Bee-Core.
- Explicit manual approval in Bee-Core.
- Android receives the active status and displays the paired state.
- Capability badges are displayed from the server response.

**Not claimed as fully validated by this test:**
- Cross-tenant security and authorization regression.
- Expiry/replay and rate-limit edge cases.
- Suspend, reactivate, revoke and credential rotation scenarios.
- Long-duration background execution, process termination and recovery under all Android power-management modes.
- All Android OS versions and device manufacturers.

Those scenarios should remain part of the wider regression/security test plan. This document records the successful functional acceptance path and must not be interpreted as a complete security certification.
