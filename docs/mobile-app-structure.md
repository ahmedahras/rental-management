# Mobile App Structure (Android + iOS)

## Stack

- Flutter (single codebase for Android + iOS)
- `http` for API client
- `shared_preferences` for token persistence
- `connectivity_plus` for offline detection
- `url_launcher` for WhatsApp click-to-chat open

## Navigation

- Login (single admin)
- Dashboard summary
- Quick Payment
- Master Data Entry (Owner, Shop, Tenant)

## Key Mobile Flows

1. Mark as Paid
- Select pending rent from dropdown (shop + tenant + due)
- Amount auto-fills from remaining due
- Submit payment
- If fully paid, invoice + WhatsApp links become available

2. Send Bill to Tenant / Owner
- Tap button in app
- Opens `wa.me` link from backend
- Admin manually taps Send in WhatsApp

3. Offline-safe payments
- If network unavailable, payment payload is queued locally
- Periodic sync retries every 15 seconds
- On reconnect, queued payments are posted automatically

## Build

- Android:
  - `flutter build apk --release`
- iOS:
  - `flutter build ios --release`

## Run

- Android emulator:
  - `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000`
- iOS simulator / Web:
  - `flutter run --dart-define=API_BASE_URL=http://localhost:4000`
- Physical device:
  - `flutter run --dart-define=API_BASE_URL=http://<LAN-IP>:4000`
