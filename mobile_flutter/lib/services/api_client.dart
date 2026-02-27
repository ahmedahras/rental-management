import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../app_config.dart';

class ApiClient {
  static const _tokenKey = 'admin_token';

  Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  Future<String> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey) ?? '';
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body, {bool auth = true}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth) {
      final token = await getToken();
      if (token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    final response = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: headers,
      body: jsonEncode(body),
    );

    return _decodeResponse(response);
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body, {bool auth = true}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth) {
      final token = await getToken();
      if (token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    final response = await http.patch(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: headers,
      body: jsonEncode(body),
    );

    return _decodeResponse(response);
  }

  Future<dynamic> get(String path, {bool auth = true}) async {
    final headers = <String, String>{};
    if (auth) {
      final token = await getToken();
      if (token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    final response = await http.get(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: headers,
    );

    return _decodeResponse(response);
  }

  Future<Uint8List> getBytes(String path, {bool auth = true}) async {
    final headers = <String, String>{};
    if (auth) {
      final token = await getToken();
      if (token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    final response = await http.get(
      Uri.parse('${AppConfig.apiBaseUrl}$path'),
      headers: headers,
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      String message = 'Download failed';
      try {
        final payload = jsonDecode(response.body);
        if (payload is Map<String, dynamic> && payload['message'] != null) {
          message = payload['message'].toString();
        }
      } catch (_) {
        // Ignore non-JSON errors.
      }
      throw Exception(message);
    }

    return response.bodyBytes;
  }

  dynamic _decodeResponse(http.Response response) {
    dynamic payload;
    if (response.body.isNotEmpty) {
      payload = jsonDecode(response.body);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = payload is Map<String, dynamic> ? (payload['message'] ?? 'Request failed') : 'Request failed';
      throw Exception(message);
    }

    return payload;
  }
}
