# MediEdge AI

A React Native / Expo mobile app for the MediEdge AI final year project. Android and iOS share one TypeScript codebase. No account, backend, cloud inference or image upload service is required.

## Included

- Home dashboard and brain tumor, bone fracture, lung cancer and breast cancer categories.
- Gallery import and camera capture with permission handling.
- Image previews, persistent local history, search and category filters.
- Scan details, individual deletion and clear-all with confirmation.
- Model library showing all four models as not yet added.
- Responsive browser preview for development.

**Models are not included.** Saved scans are marked “Awaiting model.” No diagnosis, confidence score or visual explanation is generated.

Interface previews: [Home](docs/screenshots/home.png), [New scan](docs/screenshots/new-scan.png), [Settings](docs/screenshots/settings.png).

## Run on your phone

Use a Node.js version supported by Expo SDK 57 and npm. From the project directory:

```powershell
npm.cmd ci
npm.cmd start
```

Open the QR code in a compatible Expo Go installation on your phone. The phone and development computer normally need to be on the same network. If Expo Go does not support the project's SDK, create a development build instead.

```powershell
npm.cmd run android   # Android emulator/device with Android development tools
npm.cmd run web       # Browser preview
```

On macOS with Xcode, `npm run ios` opens the iOS simulator. Windows cannot locally build iOS apps.

## Standalone offline Android build

Expo Go is a development host, not the standalone offline deliverable. Install Android Studio, the Android SDK and a compatible JDK, connect an Android phone with USB debugging, then run:

```powershell
npx.cmd expo run:android --variant release
```

This generates the native project and builds a release variant with its JavaScript bundle included. First-time dependency installation/builds need internet. After installation, verify gallery/camera input, saving, restart persistence and deletion in airplane mode without Metro. Distribution needs your release signing configuration. An APK has not been built or device-tested in this workspace unless explicitly reported.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

`build` exports Android, iOS and web JavaScript/assets; it does not produce an APK or IPA.

Verified in this workspace: TypeScript checking, four automated domain/model tests, and production exports for all three platforms. Browser interaction checks covered category selection, image import, saving, reload persistence, image rendering, search/filtering, deletion/cancellation, model status and narrow/wide layouts, with no page runtime errors. Physical-device camera permissions, native storage persistence and standalone airplane-mode use still require phone testing.

## Layout

```text
App.tsx                    Screens, navigation and image workflow
src/Icon.tsx               Bundled vector icons
src/domain.ts              Categories and validated history schema
src/storage.ts             Native image and metadata storage
src/storage.web.ts         Browser preview storage
src/models.ts              Future local inference adapter contract
tests/domain.test.ts       Data validation and missing-model checks
docs/MODEL_INTEGRATION.md   Model integration handoff
```

## Data and limitations

Native images are copied into the app's documents directory, independent of the picker's temporary cache. Metadata is local JSON. Android app backup is disabled. No application-level encryption or authentication is implemented; device protections and OS backup policies still apply. The app hides its contents while backgrounded but does not claim screenshot prevention.

The web preview uses localStorage, with browser quota limits; it is not the intended deployment for medical data. Uninstalling the app or clearing browser data may remove scans. Deleting saved scans does not delete gallery originals. Camera permission is requested when capture is chosen.

Inputs are normalized to JPEG without resizing/cropping. Intended inputs are JPEG/PNG up to 25 MB when the picker provides file size. DICOM and image modality verification are not implemented. Final preprocessing, inference, confidence and explanation views depend on supplied models; see [the integration guide](docs/MODEL_INTEGRATION.md).

The proposal describes lung disease with chest X-rays; the UI uses lung cancer as requested. The future model's documented scope must resolve this difference.

Research prototype only. Medical images and future predictions require qualified clinical review.

Expo references: [image picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) and [file system](https://docs.expo.dev/versions/latest/sdk/filesystem/).
