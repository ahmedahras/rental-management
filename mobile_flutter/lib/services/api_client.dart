import 'dart:typed_data';

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app_config.dart';

class ApiClient {
  ApiClient({Future<void> Function()? onSessionExpired})
      : _onSessionExpired = onSessionExpired,
        _dio = Dio(
          BaseOptions(
            baseUrl: AppConfig.apiBaseUrl,
            connectTimeout: const Duration(seconds: 20),
            receiveTimeout: const Duration(seconds: 20),
            sendTimeout: const Duration(seconds: 20),
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onError: _onError,
      ),
    );
  }

  static const _legacyTokenKey = 'admin_token';
  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  final Dio _dio;
  final Future<void> Function()? _onSessionExpired;

  Completer<bool>? _refreshCompleter;
  bool _sessionExpiryHandled = false;

  Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_legacyTokenKey, token);
    await prefs.setString(_accessTokenKey, token);
  }

  Future<void> setTokens({required String accessToken, required String refreshToken}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_legacyTokenKey, accessToken);
    await prefs.setString(_accessTokenKey, accessToken);
    await prefs.setString(_refreshTokenKey, refreshToken);
    _sessionExpiryHandled = false;
  }

  Future<void> setAccessToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_legacyTokenKey, token);
    await prefs.setString(_accessTokenKey, token);
    _sessionExpiryHandled = false;
  }

  Future<String> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessTokenKey) ?? prefs.getString(_legacyTokenKey) ?? '';
  }

  Future<String> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_refreshTokenKey) ?? '';
  }

  Future<void> clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_legacyTokenKey);
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
  }

  Future<void> login({required String username, required String password}) async {
    final data = await post('/auth/login', {
      'username': username,
      'password': password,
    }, auth: false);

    final accessToken = _readString(data, ['accessToken', 'access_token']);
    final refreshToken = _readString(data, ['refreshToken', 'refresh_token']);

    if (accessToken == null || accessToken.isEmpty || refreshToken == null || refreshToken.isEmpty) {
      throw Exception('Invalid login response. Please try again.');
    }

    await setTokens(accessToken: accessToken, refreshToken: refreshToken);
  }

  Future<void> logout({bool callBackend = false}) async {
    if (callBackend) {
      try {
        await post('/auth/logout', const {}, auth: true);
      } catch (_) {
        // Ignore backend logout failures and clear local tokens anyway.
      }
    }
    await clearToken();
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body, {bool auth = true}) async {
    final response = await _dio.post<dynamic>(
      path,
      data: body,
      options: Options(extra: {'skipAuth': !auth}),
    );

    final data = response.data;
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body, {bool auth = true}) async {
    final response = await _dio.patch<dynamic>(
      path,
      data: body,
      options: Options(extra: {'skipAuth': !auth}),
    );

    final data = response.data;
    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }
    return <String, dynamic>{};
  }

  Future<dynamic> get(String path, {bool auth = true}) async {
    final response = await _dio.get<dynamic>(
      path,
      options: Options(extra: {'skipAuth': !auth}),
    );
    return response.data;
  }

  Future<Uint8List> getBytes(String path, {bool auth = true}) async {
    final response = await _dio.get<dynamic>(
      path,
      options: Options(
        responseType: ResponseType.bytes,
        extra: {'skipAuth': !auth},
      ),
    );

    final data = response.data;
    if (data is Uint8List) {
      return data;
    }
    if (data is List<int>) {
      return Uint8List.fromList(data);
    }
    throw Exception('Download failed');
  }

  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final skipAuth = options.extra['skipAuth'] == true;
    if (!skipAuth) {
      final token = await getToken();
      if (token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  Future<void> _onError(DioException err, ErrorInterceptorHandler handler) async {
    final statusCode = err.response?.statusCode;
    final request = err.requestOptions;

    final isUnauthorized = statusCode == 401;
    final isRefreshCall = request.extra['isRefreshCall'] == true || request.path.contains('/auth/refresh');
    final alreadyRetried = request.extra['retried'] == true;

    if (!isUnauthorized || isRefreshCall || alreadyRetried) {
      final message = _errorMessageFromDio(err);
      handler.next(_toWrappedException(err, message));
      return;
    }

    final refreshed = await _refreshAccessTokenSingleFlight();
    if (!refreshed) {
      await clearToken();
      await _notifySessionExpiredOnce();
      handler.next(_toWrappedException(err, 'Session expired, please login again'));
      return;
    }

    try {
      final accessToken = await getToken();
      final response = await _retryRequest(request, accessToken);
      handler.resolve(response);
    } catch (retryError) {
      if (retryError is DioException) {
        final message = _errorMessageFromDio(retryError);
        handler.next(_toWrappedException(retryError, message));
        return;
      }
      handler.next(_toWrappedException(err, 'Request failed'));
    }
  }

  Future<Response<dynamic>> _retryRequest(RequestOptions request, String accessToken) {
    final retryHeaders = Map<String, dynamic>.from(request.headers);
    if (accessToken.isNotEmpty) {
      retryHeaders['Authorization'] = 'Bearer $accessToken';
    }

    final retryExtra = Map<String, dynamic>.from(request.extra);
    retryExtra['retried'] = true;

    return _dio.request<dynamic>(
      request.path,
      data: request.data,
      queryParameters: Map<String, dynamic>.from(request.queryParameters),
      options: Options(
        method: request.method,
        headers: retryHeaders,
        responseType: request.responseType,
        contentType: request.contentType,
        receiveDataWhenStatusError: request.receiveDataWhenStatusError,
        followRedirects: request.followRedirects,
        validateStatus: request.validateStatus,
        sendTimeout: request.sendTimeout,
        receiveTimeout: request.receiveTimeout,
        extra: retryExtra,
      ),
    );
  }

  Future<bool> _refreshAccessTokenSingleFlight() async {
    if (_refreshCompleter != null) {
      return _refreshCompleter!.future;
    }

    _refreshCompleter = Completer<bool>();
    try {
      final refreshToken = await getRefreshToken();
      if (refreshToken.isEmpty) {
        _refreshCompleter!.complete(false);
        return false;
      }

      final response = await _dio.post<dynamic>(
        '/auth/refresh',
        data: {
          'refreshToken': refreshToken,
          'refresh_token': refreshToken,
        },
        options: Options(extra: {'skipAuth': true, 'isRefreshCall': true}),
      );

      final data = response.data;
      final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      final newAccessToken = _readString(map, ['accessToken', 'access_token']);

      if (newAccessToken == null || newAccessToken.isEmpty) {
        _refreshCompleter!.complete(false);
        return false;
      }

      await setAccessToken(newAccessToken);
      _refreshCompleter!.complete(true);
      return true;
    } catch (_) {
      _refreshCompleter!.complete(false);
      return false;
    } finally {
      _refreshCompleter = null;
    }
  }

  Future<void> _notifySessionExpiredOnce() async {
    if (_sessionExpiryHandled) return;
    _sessionExpiryHandled = true;
    final callback = _onSessionExpired;
    if (callback != null) {
      await callback();
    }
  }

  String _errorMessageFromDio(DioException error) {
    final data = error.response?.data;
    if (data is Map && data['message'] != null) {
      return data['message'].toString();
    }
    if (data is String && data.trim().isNotEmpty) {
      return data;
    }
    return 'Request failed';
  }

  DioException _toWrappedException(DioException original, String message) {
    return DioException(
      requestOptions: original.requestOptions,
      response: original.response,
      type: original.type,
      error: Exception(message),
      message: message,
      stackTrace: original.stackTrace,
    );
  }

  String? _readString(Map<String, dynamic> source, List<String> keys) {
    for (final key in keys) {
      final value = source[key];
      if (value is String && value.isNotEmpty) {
        return value;
      }
    }
    return null;
  }
}
