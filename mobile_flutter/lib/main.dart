import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'models/dashboard_summary.dart';
import 'services/api_client.dart';
import 'services/file_download.dart';
import 'services/offline_queue_service.dart';

part 'ui/dashboard_tab.part.dart';
part 'ui/reports_tab.part.dart';
part 'ui/admin_tab.part.dart';

void main() {
  runApp(const ShopManagementApp());
}

class ShopManagementApp extends StatelessWidget {
  const ShopManagementApp({super.key});

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF2E7D6F);
    const background = Color(0xFFF7F9FB);
    const cardBackground = Color(0xFFFFFFFF);
    const textPrimary = Color(0xFF1F2937);
    const textSecondary = Color(0xFF6B7280);
    const success = Color(0xFF16A34A);
    const danger = Color(0xFFDC2626);

    final base = ThemeData(
      useMaterial3: true,
      fontFamily: 'Roboto',
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        primary: primary,
        secondary: primary,
        error: danger,
        surface: cardBackground,
      ).copyWith(
        onSurface: textPrimary,
        onPrimary: Colors.white,
      ),
    );

    return MaterialApp(
      title: 'Shop Management (Flutter)',
      theme: base.copyWith(
        scaffoldBackgroundColor: background,
        cardTheme: CardTheme(
          color: cardBackground,
          elevation: 2,
          shadowColor: Colors.black.withOpacity(0.08),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          margin: EdgeInsets.zero,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: textPrimary,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
        textTheme: base.textTheme.copyWith(
          titleLarge: base.textTheme.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w600, color: textPrimary),
          titleMedium: base.textTheme.titleMedium?.copyWith(fontSize: 16, fontWeight: FontWeight.w500, color: textPrimary),
          bodyMedium: base.textTheme.bodyMedium?.copyWith(color: textPrimary),
          bodySmall: base.textTheme.bodySmall?.copyWith(color: textSecondary),
          labelSmall: base.textTheme.labelSmall?.copyWith(color: textSecondary),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: primary, width: 1.2)),
          labelStyle: const TextStyle(color: textSecondary),
        ),
        chipTheme: base.chipTheme.copyWith(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          side: BorderSide(color: Colors.grey.shade200),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        ),
        tabBarTheme: const TabBarTheme(
          labelColor: primary,
          unselectedLabelColor: textSecondary,
          indicatorColor: primary,
          labelStyle: TextStyle(fontWeight: FontWeight.w600),
        ),
        extensions: const <ThemeExtension<dynamic>>[
          AppColors(success: success, danger: danger, textSecondary: textSecondary),
        ],
      ),
      home: const BootstrapPage(),
    );
  }
}

@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.success,
    required this.danger,
    required this.textSecondary,
  });

  final Color success;
  final Color danger;
  final Color textSecondary;

  @override
  ThemeExtension<AppColors> copyWith({Color? success, Color? danger, Color? textSecondary}) {
    return AppColors(
      success: success ?? this.success,
      danger: danger ?? this.danger,
      textSecondary: textSecondary ?? this.textSecondary,
    );
  }

  @override
  ThemeExtension<AppColors> lerp(covariant ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      success: Color.lerp(success, other.success, t) ?? success,
      danger: Color.lerp(danger, other.danger, t) ?? danger,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t) ?? textSecondary,
    );
  }
}

enum AppScreenSize {
  mobile,
  tablet,
  desktop,
}

class ResponsiveLayout extends StatelessWidget {
  const ResponsiveLayout({
    super.key,
    required this.mobile,
    required this.tablet,
    required this.desktop,
  });

  final Widget mobile;
  final Widget tablet;
  final Widget desktop;

  static AppScreenSize screenSizeOf(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width <= 600) return AppScreenSize.mobile;
    if (width <= 1024) return AppScreenSize.tablet;
    return AppScreenSize.desktop;
  }

  @override
  Widget build(BuildContext context) {
    switch (screenSizeOf(context)) {
      case AppScreenSize.mobile:
        return mobile;
      case AppScreenSize.tablet:
        return tablet;
      case AppScreenSize.desktop:
        return desktop;
    }
  }
}

class BootstrapPage extends StatefulWidget {
  const BootstrapPage({super.key});

  @override
  State<BootstrapPage> createState() => _BootstrapPageState();
}

class _BootstrapPageState extends State<BootstrapPage> {
  final _api = ApiClient();
  bool _loading = true;
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final token = await _api.getToken();
    setState(() {
      _loggedIn = token.isNotEmpty;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return _loggedIn
        ? DashboardPage(api: _api)
        : LoginPage(
            api: _api,
            onLoggedIn: () => setState(() => _loggedIn = true),
          );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.api, required this.onLoggedIn});

  final ApiClient api;
  final VoidCallback onLoggedIn;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _username = TextEditingController(text: 'admin');
  final _password = TextEditingController(text: 'Admin@2026#Ahras');
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final result = await widget.api.post('/auth/login', {
        'username': _username.text.trim(),
        'password': _password.text,
      }, auth: false);

      await widget.api.setToken(result['access_token'] as String);
      widget.onLoggedIn();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Admin Login')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            TextField(controller: _username, decoration: const InputDecoration(labelText: 'Username')),
            const SizedBox(height: 12),
            TextField(controller: _password, decoration: const InputDecoration(labelText: 'Password'), obscureText: true),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: Text(_loading ? 'Signing In...' : 'Sign In'),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key, required this.api});

  final ApiClient api;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late final OfflineQueueService _queue;
  DashboardSummary? _summary;
  String? _error;

  final _rentId = TextEditingController();
  final _amount = TextEditingController(text: '0');
  String _paymentMode = 'CASH';
  String _queueInfo = '';

  String _tenantWaLink = '';
  String _ownerWaLink = '';

  List<Map<String, dynamic>> _pendingRents = [];
  String? _selectedRentId;

  List<Map<String, dynamic>> _owners = [];
  List<Map<String, dynamic>> _allShops = [];
  List<Map<String, dynamic>> _vacantShops = [];
  String? _selectedOwnerId;
  Map<String, dynamic>? _ownerSummary;
  List<Map<String, dynamic>> _ownerDueShops = [];
  List<Map<String, dynamic>> _ownerTenantDues = [];
  String? _selectedTenantDueId;

  String? _reportMonth;
  String? _reportOwnerId;
  List<String> _reportAvailableMonths = [];
  Map<String, dynamic>? _reportSummary;
  List<Map<String, dynamic>> _reportMonthlyComparison = [];
  List<Map<String, dynamic>> _reportShopBreakdown = [];
  List<Map<String, dynamic>> _reportTenantBreakdown = [];
  List<Map<String, dynamic>> _reportLineSeries = [];
  List<Map<String, dynamic>> _reportBarSeries = [];
  List<Map<String, dynamic>> _reportDonutSeries = [];
  List<Map<String, dynamic>> _reportAgingSeries = [];
  bool _reportLoading = false;
  bool _reportExporting = false;

  String? _shopOwnerId;
  String? _statusShopId;
  String _statusValue = 'VACANT';

  final _shopNumber = TextEditingController();
  final _shopRent = TextEditingController(text: '5000');

  final _tenantName = TextEditingController();
  final _tenantPhone = TextEditingController();
  final _tenantStartDate = TextEditingController(text: '2026-02-01');
  final _tenantNewShopNumber = TextEditingController();
  final _tenantNewShopName = TextEditingController();
  final _tenantNewShopRent = TextEditingController(text: '5000');

  Timer? _syncTimer;
  bool _payLoading = false;
  bool _createLoading = false;

  List<Map<String, dynamic>> _uniqueByKey(
    List<Map<String, dynamic>> items,
    String key,
  ) {
    final seen = <String>{};
    final result = <Map<String, dynamic>>[];
    for (final item in items) {
      final value = (item[key] ?? '').toString();
      if (value.isEmpty || seen.contains(value)) continue;
      seen.add(value);
      result.add(item);
    }
    return result;
  }

  String? _safeDropdownValue(
    String? value,
    List<Map<String, dynamic>> items,
    String key,
  ) {
    if (value == null) return null;
    final count = items.where((e) => (e[key] ?? '').toString() == value).length;
    return count == 1 ? value : null;
  }

  String? _safeStringDropdownValue(String? value, List<String> items) {
    if (value == null) return null;
    final count = items.where((e) => e == value).length;
    return count == 1 ? value : null;
  }

  double _asDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  @override
  void initState() {
    super.initState();
    _queue = OfflineQueueService(widget.api);
    _loadAll();

    _syncTimer = Timer.periodic(const Duration(seconds: 15), (_) async {
      final result = await _queue.process();
      if (!mounted) return;
      if ((result['processed'] ?? 0) > 0) {
        setState(() {
          _queueInfo = 'Synced ${result['processed']} queued payment(s).';
        });
        _loadAll();
      }
    });
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    _rentId.dispose();
    _amount.dispose();
    _shopNumber.dispose();
    _shopRent.dispose();
    _tenantName.dispose();
    _tenantPhone.dispose();
    _tenantStartDate.dispose();
    _tenantNewShopNumber.dispose();
    _tenantNewShopName.dispose();
    _tenantNewShopRent.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    await _loadSummary();
    await _loadOwners();
    await _loadOwnerDueBreakdown();
    await _loadShops();
    await _loadPendingRents();
    await _loadReportsData();
  }

  Future<void> _loadReportsData() async {
    setState(() => _reportLoading = true);
    try {
      final queryParts = <String>[];
      if (_reportMonth != null && _reportMonth!.isNotEmpty) {
        queryParts.add('month=$_reportMonth');
      }
      if (_reportOwnerId != null && _reportOwnerId!.isNotEmpty) {
        queryParts.add('owner_id=$_reportOwnerId');
      }

      final path = queryParts.isEmpty
          ? '/reports/monthly-dashboard'
          : '/reports/monthly-dashboard?${queryParts.join('&')}';

      final data = await widget.api.get(path) as Map<String, dynamic>;
      final charts = Map<String, dynamic>.from(data['charts'] as Map? ?? const {});
      final availableMonthsRaw = (data['available_months'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList();
      final availableMonths = availableMonthsRaw.toSet().toList()..sort();
      final selectedMonth = (data['selected_month'] ?? '').toString();

      setState(() {
        _reportAvailableMonths = availableMonths;
        _reportMonth = _safeStringDropdownValue(
          selectedMonth.isNotEmpty ? selectedMonth : null,
          _reportAvailableMonths,
        );
        _reportSummary = Map<String, dynamic>.from(data['summary'] as Map? ?? const {});
        _reportMonthlyComparison = (data['monthly_comparison'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _reportShopBreakdown = (data['shop_breakdown'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .where((e) => _asDouble(e['total_due']) > 0)
            .toList();
        _reportTenantBreakdown = (data['tenant_breakdown'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .where((e) => _asDouble(e['total_due']) > 0)
            .toList();
        _reportLineSeries = (charts['line_series'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _reportBarSeries = (charts['bar_series'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _reportDonutSeries = (charts['donut_series'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _reportAgingSeries = (charts['aging_series'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (e) {
      setState(() {
        _reportSummary = null;
        _reportMonthlyComparison = [];
        _reportShopBreakdown = [];
        _reportTenantBreakdown = [];
        _reportLineSeries = [];
        _reportBarSeries = [];
        _reportDonutSeries = [];
        _reportAgingSeries = [];
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      setState(() => _reportLoading = false);
    }
  }

  String _reportFileTimestamp() {
    final now = DateTime.now().toIso8601String().split('.').first.replaceAll(':', '').replaceAll('-', '');
    return now.replaceFirst('T', '-');
  }

  Future<void> _downloadMonthlyExcelReport() async {
    setState(() {
      _reportExporting = true;
      _error = null;
    });
    try {
      final queryParts = <String>[];
      if (_reportMonth != null && _reportMonth!.isNotEmpty) {
        queryParts.add('month=$_reportMonth');
      }
      if (_reportOwnerId != null && _reportOwnerId!.isNotEmpty) {
        queryParts.add('owner_id=$_reportOwnerId');
      }
      final path = queryParts.isEmpty
          ? '/reports/export/monthly-excel'
          : '/reports/export/monthly-excel?${queryParts.join('&')}';
      final bytes = await widget.api.getBytes(path);
      final month = _reportMonth ?? 'latest';
      final filename = 'monthly-report-$month-${_reportFileTimestamp()}.xlsx';
      saveFileFromBytes(
        filename: filename,
        bytes: bytes,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _reportExporting = false);
    }
  }

  Future<void> _downloadFullExcelReport() async {
    setState(() {
      _reportExporting = true;
      _error = null;
    });
    try {
      final path = (_reportOwnerId != null && _reportOwnerId!.isNotEmpty)
          ? '/reports/export/full-excel?owner_id=$_reportOwnerId'
          : '/reports/export/full-excel';
      final bytes = await widget.api.getBytes(path);
      final filename = 'full-report-${_reportFileTimestamp()}.xlsx';
      saveFileFromBytes(
        filename: filename,
        bytes: bytes,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _reportExporting = false);
    }
  }

  Future<void> _loadSummary() async {
    setState(() => _error = null);
    try {
      final data = await widget.api.get('/dashboard/summary') as Map<String, dynamic>;
      setState(() => _summary = DashboardSummary.fromJson(data));
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _loadOwners() async {
    try {
      final data = await widget.api.get('/owners') as List<dynamic>;
      final owners = _uniqueByKey(
        data.map((e) => Map<String, dynamic>.from(e as Map)).toList(),
        'owner_id',
      );
      setState(() {
        _owners = owners;
        _shopOwnerId ??= owners.isNotEmpty ? owners.first['owner_id'] as String : null;
        _selectedOwnerId ??= owners.isNotEmpty ? owners.first['owner_id'] as String : null;
      });
    } catch (_) {
      // no-op
    }
  }

  Future<void> _loadOwnerDueBreakdown() async {
    if (_selectedOwnerId == null) {
      setState(() {
        _ownerSummary = null;
        _ownerDueShops = [];
        _ownerTenantDues = [];
      });
      return;
    }

    try {
      final data = await widget.api.get('/owners/${_selectedOwnerId!}/due-breakdown')
          as Map<String, dynamic>;
      final summary = Map<String, dynamic>.from(data['summary'] as Map? ?? const {});
      final dueShops = ((data['due_shops'] as List<dynamic>? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList());
      final tenantDues = ((data['tenant_dues'] as List<dynamic>? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList());

      setState(() {
        _ownerSummary = {
          'owner_name': data['owner_name'],
          'expected_rent': summary['expected_rent'] ?? 0,
          'collected_rent': summary['collected_rent'] ?? 0,
          'total_due': summary['total_due'] ?? 0,
        };
        _ownerDueShops = dueShops.where((s) => _asDouble(s['total_due']) > 0).toList();
        _ownerTenantDues = tenantDues.where((t) => _asDouble(t['total_due']) > 0).toList();
        _selectedTenantDueId = null;
      });
    } catch (e) {
      setState(() {
        _ownerSummary = null;
        _ownerDueShops = [];
        _ownerTenantDues = [];
        _selectedTenantDueId = null;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _loadShops() async {
    try {
      final data = await widget.api.get('/shops') as List<dynamic>;
      final shops = _uniqueByKey(
        data.map((e) => Map<String, dynamic>.from(e as Map)).toList(),
        'shop_id',
      );
      final vacant = shops.where((s) => (s['status'] as String?) == 'VACANT').toList();
      setState(() {
        _allShops = shops;
        _vacantShops = vacant;
        if (_statusShopId == null || !_allShops.any((s) => s['shop_id'] == _statusShopId)) {
          _statusShopId = _allShops.isNotEmpty ? _allShops.first['shop_id'] as String : null;
        }
      });
    } catch (_) {
      // no-op
    }
  }

  Future<void> _loadPendingRents() async {
    try {
      final data = _selectedOwnerId == null
          ? await widget.api.get('/rents') as List<dynamic>
          : await widget.api.get('/owners/${_selectedOwnerId!}/pending-rents') as List<dynamic>;
      final rents = _uniqueByKey(
        data
            .map((e) => Map<String, dynamic>.from(e as Map))
            .where((r) => (r['payment_status'] as String?) != 'PAID')
            .toList(),
        'rent_id',
      );

      setState(() {
        _pendingRents = rents;
        _selectedRentId = _safeDropdownValue(_selectedRentId, _pendingRents, 'rent_id');
        if (_selectedTenantDueId != null) {
          final exists = _ownerTenantDues.any((t) => (t['tenant_id'] ?? '').toString() == _selectedTenantDueId);
          if (!exists) {
            _selectedTenantDueId = null;
          }
        }
      });
    } catch (_) {
      // no-op
    }
  }

  void _selectRent(String? rentId) {
    if (rentId == null) return;
    final rent = _pendingRents.firstWhere(
      (r) => r['rent_id'] == rentId,
      orElse: () => <String, dynamic>{},
    );
    if (rent.isEmpty) return;

    final remaining = _asDouble(rent['remaining_due']);

    setState(() {
      _selectedRentId = rentId;
      _rentId.text = rentId;
      _amount.text = remaining.toStringAsFixed(2);
      _error = null;
    });
  }

  Future<void> _logout() async {
    await widget.api.clearToken();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => LoginPage(api: widget.api, onLoggedIn: () {
          Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => DashboardPage(api: widget.api)));
        }),
      ),
      (_) => false,
    );
  }

  Future<void> _markPaid() async {
    final rentId = _selectedRentId ?? _rentId.text.trim();
    final amount = double.tryParse(_amount.text);

    if (rentId.isEmpty) {
      setState(() => _error = 'Select a pending rent.');
      return;
    }

    if (amount == null || amount <= 0) {
      setState(() => _error = 'Amount must be greater than 0.');
      return;
    }

    setState(() {
      _payLoading = true;
      _error = null;
      _queueInfo = '';
    });

    final payload = {
      'rent_id': rentId,
      'amount': amount,
      'payment_mode': _paymentMode,
    };

    try {
      final result = await widget.api.post('/payments', payload);
      final wa = result['whatsapp_links'] as Map<String, dynamic>?;

      setState(() {
        _tenantWaLink = wa?['tenantWaLink'] as String? ?? '';
        _ownerWaLink = wa?['ownerWaLink'] as String? ?? '';
      });

      await _loadAll();
    } catch (e) {
      final connectivity = await Connectivity().checkConnectivity();
      final isOffline = connectivity.contains(ConnectivityResult.none);

      if (isOffline) {
        await _queue.enqueue(payload);
        setState(() {
          _queueInfo = 'Saved offline. Will auto-sync.';
        });
      } else {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      setState(() => _payLoading = false);
    }
  }

  Future<void> _createShop() async {
    final rent = double.tryParse(_shopRent.text);
    if (
        _shopOwnerId == null ||
        _shopNumber.text.trim().isEmpty ||
        rent == null ||
        rent < 0) {
      setState(() => _error = 'Shop number, owner, and valid monthly rent are required.');
      return;
    }

    setState(() {
      _createLoading = true;
      _error = null;
    });

    try {
      await widget.api.post('/shops', {
        'shop_number': _shopNumber.text.trim(),
        'shop_name': _shopNumber.text.trim(),
        'owner_id': _shopOwnerId,
        'monthly_rent': rent,
      });
      _shopNumber.clear();
      await _loadShops();
      await _loadSummary();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _createLoading = false);
    }
  }

  Future<void> _createTenant() async {
    if (_tenantName.text.trim().isEmpty || _tenantPhone.text.trim().isEmpty) {
      setState(() => _error = 'Tenant name and WhatsApp are required.');
      return;
    }

    setState(() {
      _createLoading = true;
      _error = null;
    });

    try {
      String? tenantShopId;
      final shopNumber = _tenantNewShopNumber.text.trim();
      final inlineRent = double.tryParse(_tenantNewShopRent.text);
      final ownerIdForNewShop = _shopOwnerId ??
          _selectedOwnerId ??
          (_owners.isNotEmpty ? (_owners.first['owner_id'] as String?) : null);
      if (ownerIdForNewShop == null ||
          shopNumber.isEmpty ||
          _tenantNewShopName.text.trim().isEmpty ||
          inlineRent == null ||
          inlineRent < 0) {
        setState(() => _error = 'For tenant: select owner, then enter shop number, shop name, and valid monthly rent.');
        return;
      }

      // Reuse existing vacant shop if the entered shop number already exists.
      final existingVacant = _vacantShops.firstWhere(
        (s) => (s['shop_number'] ?? '').toString().trim() == shopNumber,
        orElse: () => <String, dynamic>{},
      );
      if (existingVacant.isNotEmpty) {
        tenantShopId = (existingVacant['shop_id'] ?? '').toString();
        final existingShopName = (existingVacant['shop_name'] ?? '').toString().trim();
        final desiredShopName = _tenantNewShopName.text.trim();
        final existingMonthlyRent = _asDouble(existingVacant['monthly_rent']);
        if (tenantShopId.isNotEmpty &&
            (existingShopName != desiredShopName || existingMonthlyRent != inlineRent)) {
          await widget.api.patch('/shops/$tenantShopId', {
            'shop_name': desiredShopName,
            'owner_id': ownerIdForNewShop,
            'monthly_rent': inlineRent,
          });
        }
      } else {
        final createdShop = await widget.api.post('/shops', {
          'shop_number': shopNumber,
          'shop_name': _tenantNewShopName.text.trim(),
          'owner_id': ownerIdForNewShop,
          'monthly_rent': inlineRent,
        });
        tenantShopId = (createdShop['shop_id'] ?? '').toString();
      }

      if (tenantShopId == null || tenantShopId.isEmpty) {
        setState(() => _error = 'Failed to create shop for tenant.');
        return;
      }

      await widget.api.post('/tenants', {
        'tenant_name': _tenantName.text.trim(),
        'whatsapp_number': _tenantPhone.text.trim(),
        'shop_id': tenantShopId,
        'rent_start_date': _tenantStartDate.text.trim(),
      });

      _tenantName.clear();
      _tenantPhone.clear();
      _tenantNewShopNumber.clear();
      _tenantNewShopName.clear();
      await _loadAll();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _createLoading = false);
    }
  }

  Future<void> _updateShopStatus() async {
    if (_statusShopId == null) {
      setState(() => _error = 'Select a shop to update status.');
      return;
    }

    setState(() {
      _createLoading = true;
      _error = null;
    });

    try {
      await widget.api.patch('/shops/${_statusShopId!}', {'status': _statusValue});
      await _loadAll();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      setState(() => _createLoading = false);
    }
  }

  Future<void> _openWa(String link) async {
    final uri = Uri.tryParse(link);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Shop Management'),
          actions: [
            IconButton(onPressed: _loadAll, icon: const Icon(Icons.refresh)),
            IconButton(onPressed: _logout, icon: const Icon(Icons.logout)),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Dashboard'),
              Tab(text: 'Reports'),
              Tab(text: 'Admin'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _dashboardTab(),
            _reportsTab(),
            _adminTab(),
          ],
        ),
      ),
    );
  }
}
