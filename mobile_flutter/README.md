# Flutter Mobile App

Flutter implementation of the Shop Management mobile app (Android + iOS), using the same backend API.

## Implemented

- Single admin login
- Dashboard summary
- Quick payment entry
- WhatsApp click-to-chat open for tenant and owner
- Offline-safe payment queue (saved locally) with periodic auto-sync

## Run

1. Ensure backend is running (`http://localhost:4000` in this workspace).
2. Android emulator run:
   ```bash
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
   ```
3. iOS simulator run:
   ```bash
   flutter run --dart-define=API_BASE_URL=http://localhost:4000
   ```
4. Physical device run (replace with your LAN IP):
   ```bash
   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:4000
   ```

## Build

- Android APK:
  ```bash
  flutter build apk --release
  ```
- iOS:
  ```bash
  flutter build ios --release
  ```

## Notes

- WhatsApp is opened via official click-to-chat links from backend (`wa.me`).
- Final message send remains a manual tap in WhatsApp to stay policy-compliant.
