import 'package:flutter/foundation.dart';

class AppConfig {
  // Flutter web/desktop: localhost, Android emulator: 10.0.2.2,
  // iOS simulator: localhost, physical device: your LAN IP.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: kIsWeb ? 'http://localhost:4000' : 'http://10.0.2.2:4000',
  );
}
