// ignore_for_file: library_private_types_in_public_api, invalid_use_of_protected_member

part of '../main.dart';

extension ReportsTabPart on _DashboardPageState {
  static const int _maxChartPoints = 8;

  AppColors _reportColors(BuildContext context) =>
      Theme.of(context).extension<AppColors>() ??
      const AppColors(success: Color(0xFF16A34A), danger: Color(0xFFDC2626), textSecondary: Color(0xFF6B7280));

  AppScreenSize _reportScreenSize(BuildContext context) => ResponsiveLayout.screenSizeOf(context);

  int _reportColumnsFor(BuildContext context, {required int mobile, required int tablet, required int desktop}) {
    switch (_reportScreenSize(context)) {
      case AppScreenSize.mobile:
        return mobile;
      case AppScreenSize.tablet:
        return tablet;
      case AppScreenSize.desktop:
        return desktop;
    }
  }

  Widget _reportsSectionCard({
    required Widget child,
    EdgeInsetsGeometry padding = const EdgeInsets.all(16),
  }) {
    return Card(
      child: Padding(
        padding: padding,
        child: child,
      ),
    );
  }

  Widget _reportMetricCard(
    BuildContext context, {
    required String label,
    required String value,
    Color? valueColor,
    Widget? footer,
  }) {
    final textTheme = Theme.of(context).textTheme;
    final secondary = _reportColors(context).textSecondary;
    return _reportsSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: textTheme.labelSmall?.copyWith(color: secondary)),
          const SizedBox(height: 8),
          Text(
            value,
            style: textTheme.titleLarge?.copyWith(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: valueColor ?? Theme.of(context).colorScheme.onSurface,
            ),
          ),
          if (footer != null) ...[
            const SizedBox(height: 10),
            footer,
          ],
        ],
      ),
    );
  }

  List<String> _uniqueMonths(List<String> months) {
    final seen = <String>{};
    final unique = <String>[];
    for (final month in months) {
      if (seen.add(month)) {
        unique.add(month);
      }
    }
    return unique;
  }

  List<Map<String, dynamic>> _lastChartPoints(List<Map<String, dynamic>> rows) {
    if (rows.length <= _maxChartPoints) return rows;
    return rows.sublist(rows.length - _maxChartPoints);
  }

  double _maxIn(Iterable<double> values) {
    var max = 0.0;
    for (final v in values) {
      if (v > max) max = v;
    }
    return max <= 0 ? 1 : max;
  }

  Widget _valueBar({
    required double value,
    required double max,
    required Color color,
  }) {
    final ratio = (value / max).clamp(0, 1).toDouble();
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: LinearProgressIndicator(
        value: ratio,
        minHeight: 8,
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        valueColor: AlwaysStoppedAnimation<Color>(color),
      ),
    );
  }

  Widget _reportsFilterBar() {
    final months = _uniqueMonths(_reportAvailableMonths);
    final monthValue = _safeStringDropdownValue(_reportMonth, months);
    final ownerValue = _safeDropdownValue(_reportOwnerId, _owners, 'owner_id');

    final screen = _reportScreenSize(context);
    return _reportsSectionCard(
      child: LayoutBuilder(
        builder: (context, constraints) {
          const gap = 12.0;
          final isMobile = screen == AppScreenSize.mobile;
          final isDesktop = screen == AppScreenSize.desktop;
          final monthWidth = isMobile ? constraints.maxWidth : isDesktop ? 180.0 : 220.0;
          final ownerWidth = isMobile ? constraints.maxWidth : isDesktop ? 280.0 : 300.0;
          final refreshWidth = isMobile ? constraints.maxWidth : 170.0;
          final exportWidth = isMobile ? constraints.maxWidth : isDesktop ? 220.0 : (constraints.maxWidth - gap) / 2;

          return Wrap(
            spacing: gap,
            runSpacing: gap,
            crossAxisAlignment: WrapCrossAlignment.end,
            children: [
              SizedBox(
                width: monthWidth,
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: monthValue,
                  decoration: const InputDecoration(labelText: 'Month (YYYY-MM)'),
                  items: months
                      .map((m) => DropdownMenuItem<String>(
                            value: m,
                            child: Text(m, overflow: TextOverflow.ellipsis),
                          ))
                      .toList(),
                  onChanged: (v) async {
                    if (v == null) return;
                    setState(() => _reportMonth = v);
                    await _loadReportsData();
                  },
                ),
              ),
              SizedBox(
                width: ownerWidth,
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: ownerValue,
                  decoration: const InputDecoration(labelText: 'Owner (Optional)'),
                  selectedItemBuilder: (_) => [
                    const Text('All Owners', overflow: TextOverflow.ellipsis),
                    ..._owners.map((o) => Text((o['owner_name'] ?? '').toString(), overflow: TextOverflow.ellipsis)),
                  ],
                  items: [
                    const DropdownMenuItem<String>(value: null, child: Text('All Owners', overflow: TextOverflow.ellipsis)),
                    ..._owners.map((o) => DropdownMenuItem<String>(
                          value: (o['owner_id'] ?? '').toString(),
                          child: Text((o['owner_name'] ?? '').toString(), overflow: TextOverflow.ellipsis),
                        )),
                  ],
                  onChanged: (v) async {
                    setState(() => _reportOwnerId = v);
                    await _loadReportsData();
                  },
                ),
              ),
              SizedBox(
                width: refreshWidth,
                child: OutlinedButton.icon(
                  onPressed: _reportLoading ? null : _loadReportsData,
                  icon: const Icon(Icons.refresh),
                  label: Text(_reportLoading ? 'Refreshing' : 'Refresh'),
                ),
              ),
              SizedBox(
                width: exportWidth,
                child: ElevatedButton.icon(
                  onPressed: _reportExporting ? null : _downloadMonthlyExcelReport,
                  icon: const Icon(Icons.download),
                  label: Text(_reportExporting ? 'Preparing...' : 'Download Monthly Excel'),
                ),
              ),
              SizedBox(
                width: exportWidth,
                child: OutlinedButton.icon(
                  onPressed: _reportExporting ? null : _downloadFullExcelReport,
                  icon: const Icon(Icons.download),
                  label: const Text('Download Full Excel'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _reportSummaryCards() {
    if (_reportSummary == null) {
      return const Text('Summary unavailable.');
    }

    final expected = _asDouble(_reportSummary!['expected']);
    final collected = _asDouble(_reportSummary!['collected']);
    final remaining = _asDouble(_reportSummary!['remaining']);
    final percentage = _asDouble(_reportSummary!['collection_percentage']);

    final colors = _reportColors(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final columns = _reportColumnsFor(context, mobile: 1, tablet: 2, desktop: 4);
        final itemWidth = (constraints.maxWidth - (gap * (columns - 1))) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: itemWidth,
              child: _reportMetricCard(context, label: 'Expected Rent', value: 'INR ${expected.toStringAsFixed(2)}'),
            ),
            SizedBox(
              width: itemWidth,
              child: _reportMetricCard(
                context,
                label: 'Collected Rent',
                value: 'INR ${collected.toStringAsFixed(2)}',
                valueColor: colors.success,
              ),
            ),
            SizedBox(
              width: itemWidth,
              child: _reportMetricCard(
                context,
                label: 'Remaining Due',
                value: 'INR ${remaining.toStringAsFixed(2)}',
                valueColor: colors.danger,
              ),
            ),
            SizedBox(
              width: itemWidth,
              child: _reportMetricCard(
                context,
                label: 'Collection %',
                value: '${percentage.toStringAsFixed(2)}%',
                footer: LinearProgressIndicator(
                  value: (percentage.clamp(0, 100)) / 100,
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(8),
                  backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                  valueColor: AlwaysStoppedAnimation<Color>(colors.success),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _monthlyComparisonTable() {
    if (_reportMonthlyComparison.isEmpty) {
      return const Text('No monthly comparison data.');
    }

    return _reportsSectionCard(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          dataTextStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontSize: _reportScreenSize(context) == AppScreenSize.mobile ? 12 : null,
              ),
          headingTextStyle: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontSize: _reportScreenSize(context) == AppScreenSize.mobile ? 12 : null,
              ),
          headingRowHeight: 40,
          dataRowMinHeight: 44,
          columns: const [
            DataColumn(label: Text('Month')),
            DataColumn(label: Text('Expected')),
            DataColumn(label: Text('Collected')),
            DataColumn(label: Text('Remaining')),
          ],
          rows: _reportMonthlyComparison.map((row) {
            final expected = _asDouble(row['expected']);
            final collected = _asDouble(row['collected']);
            final remaining = _asDouble(row['remaining']);
            return DataRow(cells: [
              DataCell(Text((row['month'] ?? '-').toString())),
              DataCell(Text(expected.toStringAsFixed(2))),
              DataCell(Text(collected.toStringAsFixed(2))),
              DataCell(Text(remaining.toStringAsFixed(2))),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  Widget _reportShopBreakdownCard() {
    final dueColor = _reportColors(context).danger;
    return _reportsSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Shop-Wise Breakdown', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (_reportShopBreakdown.isEmpty)
            const Text('No due records.')
          else
            ..._reportShopBreakdown.asMap().entries.map((entry) {
              final idx = entry.key;
              final row = entry.value;
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: Text('Shop ${row['shop_number'] ?? '-'}')),
                      Text(
                        'INR ${_asDouble(row['total_due']).toStringAsFixed(2)}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: dueColor,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                  if (idx != _reportShopBreakdown.length - 1) const Divider(height: 20),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _reportTenantBreakdownCard() {
    final dueColor = _reportColors(context).danger;
    return _reportsSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Tenant-Wise Breakdown', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (_reportTenantBreakdown.isEmpty)
            const Text('No due records.')
          else
            ..._reportTenantBreakdown.asMap().entries.map((entry) {
              final idx = entry.key;
              final row = entry.value;
              return Column(
                children: [
                  Row(
                    children: [
                      Expanded(child: Text('${row['tenant_name'] ?? '-'} (Shop ${row['shop_number'] ?? '-'})')),
                      Text(
                        'INR ${_asDouble(row['total_due']).toStringAsFixed(2)}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: dueColor,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                  if (idx != _reportTenantBreakdown.length - 1) const Divider(height: 20),
                ],
              );
            }),
        ],
      ),
    );
  }

  Widget _chartHeader(BuildContext context, String title, List<({Color color, String label})> legends) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(
          spacing: 10,
          runSpacing: 6,
          children: legends
              .map(
                (legend) => Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(color: legend.color, borderRadius: BorderRadius.circular(2)),
                    ),
                    const SizedBox(width: 6),
                    Text(legend.label, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              )
              .toList(),
        ),
      ],
    );
  }

  Widget _lineChartCard() {
    if (_reportLineSeries.isEmpty) return const SizedBox.shrink();

    final lineSeries = _lastChartPoints(_reportLineSeries);
    final colors = _reportColors(context);
    final expectedColor = Theme.of(context).colorScheme.primary;
    final collectedColor = colors.success;
    final remainingColor = colors.danger;
    final maxValue = _maxIn(lineSeries.expand((row) => [
          _asDouble(row['expected']),
          _asDouble(row['collected']),
          _asDouble(row['remaining']),
        ]));

    return _reportsSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _chartHeader(
            context,
            'Line Chart: Expected vs Collected vs Due',
            [
              (color: expectedColor, label: 'Expected'),
              (color: collectedColor, label: 'Collected'),
              (color: remainingColor, label: 'Due'),
            ],
          ),
          const SizedBox(height: 12),
          ...lineSeries.map((row) {
            final month = (row['month'] ?? '').toString();
            final expected = _asDouble(row['expected']);
            final collected = _asDouble(row['collected']);
            final due = _asDouble(row['remaining']);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(month.isEmpty ? 'Month' : month, style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 6),
                  _valueBar(value: expected, max: maxValue, color: expectedColor),
                  const SizedBox(height: 4),
                  _valueBar(value: collected, max: maxValue, color: collectedColor),
                  const SizedBox(height: 4),
                  _valueBar(value: due, max: maxValue, color: remainingColor),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _barChartCard() {
    if (_reportBarSeries.isEmpty) return const SizedBox.shrink();

    final barSeries = _lastChartPoints(_reportBarSeries);
    final colors = _reportColors(context);
    final maxValue = _maxIn(barSeries.expand((row) => [_asDouble(row['collected']), _asDouble(row['due'])]));

    return _reportsSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _chartHeader(
            context,
            'Bar Chart: Collected vs Due',
            [
              (color: colors.success, label: 'Collected'),
              (color: colors.danger, label: 'Due'),
            ],
          ),
          const SizedBox(height: 12),
          ...barSeries.map((row) {
            final month = (row['month'] ?? '').toString();
            final collected = _asDouble(row['collected']);
            final due = _asDouble(row['due']);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(month.isEmpty ? 'Month' : month, style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 6),
                  _valueBar(value: collected, max: maxValue, color: colors.success),
                  const SizedBox(height: 4),
                  _valueBar(value: due, max: maxValue, color: colors.danger),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _donutChartCard() {
    if (_reportDonutSeries.isEmpty) return const SizedBox.shrink();

    final palette = [
      Theme.of(context).colorScheme.primary,
      Theme.of(context).colorScheme.secondary,
      Theme.of(context).colorScheme.tertiary,
      _reportColors(context).success,
      _reportColors(context).danger,
    ];
    final donutSeries = _lastChartPoints(_reportDonutSeries);
    final total = donutSeries.fold<double>(0, (sum, row) => sum + _asDouble(row['collected']));
    final safeTotal = total <= 0 ? 1 : total;

    return _reportsSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Donut Chart: Owner Contribution', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...donutSeries.asMap().entries.map((entry) {
            final idx = entry.key;
            final row = entry.value;
            final owner = (row['owner_name'] ?? 'Owner').toString();
            final collected = _asDouble(row['collected']);
            final percent = (collected / safeTotal) * 100;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(color: palette[idx % palette.length], borderRadius: BorderRadius.circular(3)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(child: Text(owner, overflow: TextOverflow.ellipsis)),
                  const SizedBox(width: 8),
                  Text('${percent.toStringAsFixed(1)}%', style: Theme.of(context).textTheme.labelMedium),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _agingChartCard() {
    if (_reportAgingSeries.isEmpty) return const SizedBox.shrink();

    final agingSeries = _lastChartPoints(_reportAgingSeries);
    final accent = Theme.of(context).colorScheme.tertiary;
    final maxValue = _maxIn(agingSeries.map((row) => _asDouble(row['total_due'])));

    return _reportsSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Aging Chart: 0-30, 31-60, 61-90, 90+', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...agingSeries.map((row) {
            final label = (row['bucket'] ?? row['label'] ?? row['range'] ?? '').toString();
            final due = _asDouble(row['total_due']);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label.isEmpty ? 'Bucket' : label, style: Theme.of(context).textTheme.labelMedium),
                  const SizedBox(height: 6),
                  _valueBar(value: due, max: maxValue, color: accent),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _chartsGrid() {
    final charts = [
      _lineChartCard(),
      _barChartCard(),
      _donutChartCard(),
      _agingChartCard(),
    ].where((w) => w is! SizedBox).toList();

    if (charts.isEmpty) return const SizedBox.shrink();

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final columns = _reportColumnsFor(context, mobile: 1, tablet: 1, desktop: 2);
        final width = (constraints.maxWidth - (gap * (columns - 1))) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: charts
              .map(
                (chart) => ConstrainedBox(
                  constraints: BoxConstraints(minHeight: _reportScreenSize(context) == AppScreenSize.mobile ? 250 : 230),
                  child: SizedBox(width: width, child: chart),
                ),
              )
              .toList(),
        );
      },
    );
  }

  Widget _reportsTab() {
    final isMobile = _reportScreenSize(context) == AppScreenSize.mobile;
    return SingleChildScrollView(
      padding: EdgeInsets.all(isMobile ? 12 : 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1320),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Reports', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 10),
              _reportsFilterBar(),
              const SizedBox(height: 12),
              if (_reportLoading && _reportSummary == null)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(),
                  ),
                )
              else ...[
                if (_error != null && _error!.isNotEmpty) ...[
                  _reportsSectionCard(
                    child: Text(
                      _error!,
                      style: TextStyle(color: _reportColors(context).danger, fontWeight: FontWeight.w500),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                _reportSummaryCards(),
                const SizedBox(height: 12),
                Text('Monthly Comparison', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                _monthlyComparisonTable(),
                const SizedBox(height: 12),
                Card(
                  child: ExpansionTile(
                    initiallyExpanded: false,
                    title: Text('Charts', style: Theme.of(context).textTheme.titleMedium),
                    subtitle: Text(
                      'Responsive analytics view',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    children: [
                      _chartsGrid(),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _reportShopBreakdownCard(),
                const SizedBox(height: 12),
                _reportTenantBreakdownCard(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
