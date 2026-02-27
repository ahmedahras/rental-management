class DashboardSummary {
  final int totalShops;
  final int occupiedShops;
  final int vacantShops;
  final double expectedRentCurrentMonth;
  final double collectedCurrentMonth;
  final double pendingDuesCurrentMonth;

  DashboardSummary({
    required this.totalShops,
    required this.occupiedShops,
    required this.vacantShops,
    required this.expectedRentCurrentMonth,
    required this.collectedCurrentMonth,
    required this.pendingDuesCurrentMonth,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic v) {
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v) ?? 0;
      return 0;
    }

    int toInt(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      if (v is String) return int.tryParse(v) ?? 0;
      return 0;
    }

    return DashboardSummary(
      totalShops: toInt(json['total_shops']),
      occupiedShops: toInt(json['occupied_shops']),
      vacantShops: toInt(json['vacant_shops']),
      expectedRentCurrentMonth: toDouble(json['expected_rent_current_month']),
      collectedCurrentMonth: toDouble(json['collected_current_month']),
      pendingDuesCurrentMonth: toDouble(json['pending_dues_current_month']),
    );
  }
}
