// ignore_for_file: library_private_types_in_public_api, invalid_use_of_protected_member

part of '../main.dart';

extension DashboardTabPart on _DashboardPageState {
  AppColors _appColors(BuildContext context) =>
      Theme.of(context).extension<AppColors>() ??
      const AppColors(success: Color(0xFF16A34A), danger: Color(0xFFDC2626), textSecondary: Color(0xFF6B7280));

  Widget _sectionTitle(BuildContext context, String text, {String? subtitle}) {
    final textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(text, style: textTheme.titleMedium),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(subtitle, style: textTheme.bodySmall),
        ],
      ],
    );
  }

  AppScreenSize _screenSize(BuildContext context) => ResponsiveLayout.screenSizeOf(context);

  int _columnsFor(BuildContext context, {required int mobile, required int tablet, required int desktop}) {
    switch (_screenSize(context)) {
      case AppScreenSize.mobile:
        return mobile;
      case AppScreenSize.tablet:
        return tablet;
      case AppScreenSize.desktop:
        return desktop;
    }
  }

  Widget _sectionCard({
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

  Widget _kpiCard(
    BuildContext context, {
    required String label,
    required String value,
    Color? valueColor,
  }) {
    final textTheme = Theme.of(context).textTheme;
    final secondary = _appColors(context).textSecondary;
    return _sectionCard(
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
        ],
      ),
    );
  }

  Widget _summaryCards() {
    final s = _summary;
    if (s == null) {
      return const Text('Loading summary...');
    }
    final colors = _appColors(context);
    final cards = [
      _kpiCard(context, label: 'Total Shops', value: '${s.totalShops}'),
      _kpiCard(context, label: 'Occupied', value: '${s.occupiedShops}'),
      _kpiCard(context, label: 'Vacant', value: '${s.vacantShops}'),
      _kpiCard(
        context,
        label: 'Pending Amount',
        value: 'INR ${s.pendingDuesCurrentMonth.toStringAsFixed(2)}',
        valueColor: colors.danger,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final columns = _columnsFor(context, mobile: 1, tablet: 2, desktop: 4);
        final itemWidth = (constraints.maxWidth - (gap * (columns - 1))) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: cards.map((w) => SizedBox(width: itemWidth, child: w)).toList(),
        );
      },
    );
  }

  Widget _ownerSummaryCard() {
    final s = _ownerSummary;
    if (s == null) {
      return _sectionCard(
        child: _sectionTitle(
          context,
          'Owner Summary',
          subtitle: 'Select an owner to view expected, collected, and due.',
        ),
      );
    }

    final expected = _asDouble(s['expected_rent']);
    final collected = _asDouble(s['collected_rent']);
    final totalDue = _asDouble(s['total_due']);
    final colors = _appColors(context);

    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context, 'Owner Summary (${s['owner_name']})'),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              const gap = 10.0;
              final columns = _columnsFor(context, mobile: 1, tablet: 2, desktop: 3);
              final itemWidth = (constraints.maxWidth - (gap * (columns - 1))) / columns;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  SizedBox(width: itemWidth, child: _kpiCard(context, label: 'Expected Rent', value: 'INR ${expected.toStringAsFixed(2)}')),
                  SizedBox(
                    width: itemWidth,
                    child: _kpiCard(
                      context,
                      label: 'Collected Rent',
                      value: 'INR ${collected.toStringAsFixed(2)}',
                      valueColor: colors.success,
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: _kpiCard(
                      context,
                      label: 'Total Due',
                      value: 'INR ${totalDue.toStringAsFixed(2)}',
                      valueColor: colors.danger,
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _dueRemainingShopsCard() {
    final danger = _appColors(context).danger;
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context, 'Due Remaining Shops'),
          const SizedBox(height: 10),
          if (_ownerDueShops.isEmpty)
            const Text('No shops with remaining due.')
          else
            ..._ownerDueShops.asMap().entries.map(
                  (entry) {
                    final idx = entry.key;
                    final shop = entry.value;
                    return Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                (shop['shop_name'] ?? '').toString().isNotEmpty
                                    ? '${shop['shop_name']} (${shop['shop_number'] ?? '-'})'
                                    : 'Shop ${shop['shop_number'] ?? '-'}',
                              ),
                            ),
                            Text(
                              'INR ${_asDouble(shop['total_due']).toStringAsFixed(2)}',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: danger,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                          ],
                        ),
                        if (idx != _ownerDueShops.length - 1) const Divider(height: 20),
                      ],
                    );
                  },
                ),
        ],
      ),
    );
  }

  Widget _tenantMonthDueList(List<Map<String, dynamic>> rows) {
    final danger = _appColors(context).danger;
    if (rows.isEmpty) return const Text('No pending months for selected tenant.');
    return Column(
      children: rows.asMap().entries.map((entry) {
        final idx = entry.key;
        final row = entry.value;
        final rentAmount = _asDouble(row['rent_amount']);
        final amountPaid = _asDouble(row['amount_paid']);
        final monthDue = (rentAmount - amountPaid).clamp(0, double.infinity);
        return Column(
          children: [
            Row(
              children: [
                Expanded(child: Text((row['month'] ?? '-').toString())),
                Text(
                  'INR ${monthDue.toStringAsFixed(2)}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: danger,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
            if (idx != rows.length - 1) const Divider(height: 20),
          ],
        );
      }).toList(),
    );
  }

  Widget _tenantDueList() {
    final danger = _appColors(context).danger;
    if (_ownerTenantDues.isEmpty) return const Text('No tenants with remaining due.');

    return Column(
      children: _ownerTenantDues.asMap().entries.map((entry) {
        final idx = entry.key;
        final tenant = entry.value;
        return Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(8),
              onTap: () {
                final tenantId = (tenant['tenant_id'] ?? '').toString();
                if (tenantId.isEmpty) return;
                setState(() {
                  _selectedTenantDueId = _selectedTenantDueId == tenantId ? null : tenantId;
                });
              },
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: _screenSize(context) == AppScreenSize.mobile ? 12 : 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        (tenant['shop_name'] ?? '').toString().isNotEmpty
                            ? '${tenant['tenant_name'] ?? '-'} (${tenant['shop_name']} - ${tenant['shop_number'] ?? '-'})'
                            : '${tenant['tenant_name'] ?? '-'} (Shop ${tenant['shop_number'] ?? '-'})',
                      ),
                    ),
                    Text(
                      'INR ${_asDouble(tenant['total_due']).toStringAsFixed(2)}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: danger,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
            ),
            if (idx != _ownerTenantDues.length - 1) const Divider(height: 16),
          ],
        );
      }).toList(),
    );
  }

  Widget _tenantWiseDueCard() {
    final selectedTenantMonthDues = _selectedTenantDueId == null
        ? <Map<String, dynamic>>[]
        : _pendingRents
            .where((r) => (r['tenant_id'] ?? '').toString() == _selectedTenantDueId)
            .map((r) => Map<String, dynamic>.from(r))
            .toList()
          ..sort((a, b) => (b['month'] ?? '').toString().compareTo((a['month'] ?? '').toString()));

    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context, 'Tenant-Wise Due Details'),
          const SizedBox(height: 10),
          _tenantDueList(),
          if (_selectedTenantDueId != null) ...[
            const SizedBox(height: 12),
            _sectionCard(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Pending Month-Wise Dues',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  _tenantMonthDueList(selectedTenantMonthDues),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _ownerSelectorCard() {
    return _sectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle(context, 'Owner Selector'),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _safeDropdownValue(_selectedOwnerId, _owners, 'owner_id'),
            decoration: const InputDecoration(labelText: 'Select Owner'),
            items: _owners
                .map((o) => DropdownMenuItem<String>(
                      value: o['owner_id'] as String,
                      child: Text(o['owner_name'] as String),
                    ))
                .toList(),
            onChanged: (v) async {
              setState(() {
                _selectedOwnerId = v;
                _selectedRentId = null;
                _selectedTenantDueId = null;
                _rentId.clear();
                _amount.text = '0';
              });
              await _loadOwnerDueBreakdown();
              await _loadPendingRents();
            },
          ),
        ],
      ),
    );
  }

  Widget _quickPaymentCard() {
    final isMobile = _screenSize(context) == AppScreenSize.mobile;
    return Card(
      child: ExpansionTile(
        initiallyExpanded: false,
        title: _sectionTitle(context, 'Quick Payment', subtitle: 'Daily rent collection and invoice actions'),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              const gap = 12.0;
              final columns = isMobile ? 1 : 2;
              final fieldWidth = (constraints.maxWidth - (gap * (columns - 1))) / columns;
              return Wrap(
                spacing: gap,
                runSpacing: gap,
                children: [
                  SizedBox(
                    width: fieldWidth,
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      value: _safeDropdownValue(_selectedRentId, _pendingRents, 'rent_id'),
                      decoration: const InputDecoration(labelText: 'Select Pending Rent'),
                      items: _pendingRents
                          .map((r) => DropdownMenuItem<String>(
                                value: r['rent_id'] as String,
                                child: Text(_rentLabel(r), overflow: TextOverflow.ellipsis),
                              ))
                          .toList(),
                      onChanged: _selectRent,
                    ),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: TextField(controller: _rentId, decoration: const InputDecoration(labelText: 'Rent Ledger UUID (auto)'), readOnly: true),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: TextField(controller: _amount, decoration: const InputDecoration(labelText: 'Amount'), keyboardType: TextInputType.number),
                  ),
                  SizedBox(
                    width: fieldWidth,
                    child: DropdownButtonFormField<String>(
                      value: _paymentMode,
                      decoration: const InputDecoration(labelText: 'Payment Mode'),
                      items: const ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']
                          .map((mode) => DropdownMenuItem(value: mode, child: Text(mode)))
                          .toList(),
                      onChanged: (v) => setState(() => _paymentMode = v ?? 'CASH'),
                    ),
                  ),
                ],
              );
            },
          ),
          if (_pendingRents.isEmpty) ...[
            const SizedBox(height: 8),
            const Text('No pending rent available for this owner.'),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _payLoading ? null : _markPaid,
              child: Text(_payLoading ? 'Saving...' : 'Mark as Paid'),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _invoicePdfLink.isEmpty ? null : () => _openWa(_invoicePdfLink),
              child: const Text('View Bill PDF'),
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _tenantWaLink.isEmpty ? null : () => _openWa(_tenantWaLink),
              child: const Text('Send Bill to Tenant'),
            ),
          ),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: _ownerWaLink.isEmpty ? null : () => _openWa(_ownerWaLink),
              child: const Text('Send Bill to Owner'),
            ),
          ),
          if (_invoiceInfo.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              _invoiceInfo,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _appColors(context).success,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ],
      ),
    );
  }

  String _rentLabel(Map<String, dynamic> r) {
    final shop = r['shop_number'] ?? '-';
    final shopName = (r['shop_name'] ?? '').toString();
    final tenant = r['tenant_name'] ?? '-';
    final month = r['month'] ?? r['rent_month'] ?? '-';
    final due = _asDouble(r['remaining_due']);
    final shopLabel = shopName.isNotEmpty ? '$shopName ($shop)' : '$shop';
    return '$month | $shopLabel | $tenant | Due: ${due.toStringAsFixed(2)}';
  }

  Widget _dashboardTab() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = _screenSize(context) == AppScreenSize.desktop;
        final horizontalPadding = _screenSize(context) == AppScreenSize.mobile ? 12.0 : 16.0;
        final contentMaxWidth = isDesktop ? 1320.0 : double.infinity;
        final dueColumnsWidth = isDesktop ? (contentMaxWidth - 12) / 2 : contentMaxWidth;

        return SingleChildScrollView(
          padding: EdgeInsets.all(horizontalPadding),
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: contentMaxWidth),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionTitle(context, 'Global Summary', subtitle: 'Daily operational snapshot'),
                  const SizedBox(height: 10),
                  _summaryCards(),
                  const SizedBox(height: 16),
                  _ownerSelectorCard(),
                  const SizedBox(height: 12),
                  _ownerSummaryCard(),
                  const SizedBox(height: 12),
                  if (isDesktop)
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        SizedBox(width: dueColumnsWidth, child: _dueRemainingShopsCard()),
                        SizedBox(width: dueColumnsWidth, child: _tenantWiseDueCard()),
                      ],
                    )
                  else ...[
                    _dueRemainingShopsCard(),
                    const SizedBox(height: 12),
                    _tenantWiseDueCard(),
                  ],
                  const SizedBox(height: 16),
                  _quickPaymentCard(),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
