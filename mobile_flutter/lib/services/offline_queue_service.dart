import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

class OfflineQueueService {
  OfflineQueueService(this.apiClient);

  final ApiClient apiClient;
  static const _queueKey = 'offline_payment_queue';

  Future<List<Map<String, dynamic>>> _getQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) {
      return [];
    }

    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> _setQueue(List<Map<String, dynamic>> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_queueKey, jsonEncode(items));
  }

  Future<void> enqueue(Map<String, dynamic> paymentPayload) async {
    final queue = await _getQueue();
    queue.add(paymentPayload);
    await _setQueue(queue);
  }

  Future<Map<String, int>> process() async {
    final connectivity = await Connectivity().checkConnectivity();
    if (connectivity.contains(ConnectivityResult.none)) {
      final remaining = (await _getQueue()).length;
      return {'processed': 0, 'remaining': remaining};
    }

    final queue = await _getQueue();
    var processed = 0;
    final remainingItems = <Map<String, dynamic>>[];

    for (final item in queue) {
      try {
        await apiClient.post('/payments', item);
        processed++;
      } catch (_) {
        remainingItems.add(item);
      }
    }

    await _setQueue(remainingItems);
    return {'processed': processed, 'remaining': remainingItems.length};
  }
}
