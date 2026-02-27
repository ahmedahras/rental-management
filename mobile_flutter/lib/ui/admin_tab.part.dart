// ignore_for_file: library_private_types_in_public_api, invalid_use_of_protected_member

part of '../main.dart';

extension AdminTabPart on _DashboardPageState {
  Widget _adminTab() {
    final screen = ResponsiveLayout.screenSizeOf(context);
    final isMobile = screen == AppScreenSize.mobile;
    return SingleChildScrollView(
      padding: EdgeInsets.all(isMobile ? 12 : 16),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1100),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Master Data Entry', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ExpansionTile(
                title: const Text('Create Shop'),
                childrenPadding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                children: [
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    value: _safeDropdownValue(_shopOwnerId, _owners, 'owner_id'),
                    decoration: const InputDecoration(labelText: 'Owner'),
                    items: _owners
                        .map((o) => DropdownMenuItem<String>(
                              value: o['owner_id'] as String,
                              child: Text(o['owner_name'] as String, overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: (v) => setState(() => _shopOwnerId = v),
                  ),
                  const SizedBox(height: 10),
                  TextField(controller: _shopNumber, decoration: const InputDecoration(labelText: 'Shop Number')),
                  const SizedBox(height: 10),
                  TextField(controller: _shopRent, decoration: const InputDecoration(labelText: 'Monthly Rent'), keyboardType: TextInputType.number),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(onPressed: _createLoading ? null : _createShop, child: const Text('Add Shop')),
                  ),
                ],
              ),
              ExpansionTile(
                title: const Text('Create Tenant'),
                childrenPadding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                children: [
                  Text(
                    'Enter shop details manually. If the shop number already exists and is VACANT, it will be reused.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  TextField(controller: _tenantNewShopNumber, decoration: const InputDecoration(labelText: 'Shop Number')),
                  const SizedBox(height: 10),
                  TextField(controller: _tenantNewShopName, decoration: const InputDecoration(labelText: 'Shop Name')),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _tenantNewShopRent,
                    decoration: const InputDecoration(labelText: 'Monthly Rent'),
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 10),
                  TextField(controller: _tenantName, decoration: const InputDecoration(labelText: 'Tenant Name')),
                  const SizedBox(height: 10),
                  TextField(controller: _tenantPhone, decoration: const InputDecoration(labelText: 'WhatsApp Number')),
                  const SizedBox(height: 10),
                  TextField(controller: _tenantStartDate, decoration: const InputDecoration(labelText: 'Rent Start Date (YYYY-MM-DD)')),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(onPressed: _createLoading ? null : _createTenant, child: const Text('Add Tenant')),
                  ),
                ],
              ),
              ExpansionTile(
                title: const Text('Update Shop Status'),
                childrenPadding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                children: [
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    value: _safeDropdownValue(_statusShopId, _allShops, 'shop_id'),
                    decoration: const InputDecoration(labelText: 'Shop'),
                    items: _allShops
                        .map((s) => DropdownMenuItem<String>(
                              value: s['shop_id'] as String,
                              child: Text('${s['shop_number']} (${s['status']})', overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: (v) => setState(() => _statusShopId = v),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    value: _statusValue,
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: const [
                      DropdownMenuItem(value: 'OCCUPIED', child: Text('OCCUPIED')),
                      DropdownMenuItem(value: 'VACANT', child: Text('VACANT')),
                    ],
                    onChanged: (v) => setState(() => _statusValue = v ?? 'VACANT'),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _createLoading ? null : _updateShopStatus,
                      child: const Text('Update Status'),
                    ),
                  ),
                ],
              ),
              if (_queueInfo.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(_queueInfo),
              ],
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
