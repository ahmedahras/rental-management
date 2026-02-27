'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PaymentActions } from '../../features/payments/PaymentActions';
import { apiDownload, apiFetch } from '../../lib/api';
import { clearToken } from '../../lib/auth';

type Summary = {
  total_shops: number;
  occupied_shops: number;
  vacant_shops: number;
  expected_rent_current_month: number;
  collected_current_month: number;
  pending_dues_current_month: number;
};

type Owner = {
  owner_id: string;
  owner_name: string;
};

type OwnerDueShop = {
  shop_id: string;
  shop_number: string;
  total_due: number;
};

type OwnerTenantDue = {
  tenant_id: string;
  tenant_name: string;
  shop_number: string;
  total_due: number;
};

type OwnerDueBreakdown = {
  owner_id: string;
  owner_name: string;
  summary: {
    expected_rent: number;
    collected_rent: number;
    total_due: number;
  };
  due_shops: OwnerDueShop[];
  tenant_dues: OwnerTenantDue[];
};

export default function DashboardPage(): JSX.Element {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [ownerDue, setOwnerDue] = useState<OwnerDueBreakdown | null>(null);
  const [ownerRefreshTick, setOwnerRefreshTick] = useState(0);
  const [rentId, setRentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Summary>('/dashboard/summary'),
      apiFetch<Owner[]>('/owners'),
    ])
      .then(([summaryData, ownerData]) => {
        setSummary(summaryData);
        setOwners(ownerData);
        if (ownerData[0]) {
          setSelectedOwnerId(ownerData[0].owner_id);
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedOwnerId) {
      setOwnerDue(null);
      return;
    }

    setOwnerLoading(true);
    setOwnerError(null);
    apiFetch<OwnerDueBreakdown>(`/owners/${selectedOwnerId}/due-breakdown`)
      .then((data) => {
        setOwnerDue({
          ...data,
          due_shops: data.due_shops.filter((shop) => shop.total_due > 0),
          tenant_dues: data.tenant_dues.filter((tenant) => tenant.total_due > 0),
        });
      })
      .catch((e) => {
        setOwnerDue(null);
        setOwnerError((e as Error).message);
      })
      .finally(() => setOwnerLoading(false));
  }, [selectedOwnerId, ownerRefreshTick]);

  async function downloadReport(reportType: 'owner_wise' | 'summary', format: 'pdf' | 'xlsx'): Promise<void> {
    setDownloadError(null);
    try {
      await apiDownload(
        `/reports/export?report_type=${reportType}&format=${format}`,
        `${reportType}.${format}`,
      );
    } catch (e) {
      setDownloadError((e as Error).message);
    }
  }

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Shop Management Dashboard</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href='/login'>Login</Link>
          <button
            onClick={() => {
              clearToken();
              window.location.href = '/login';
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {loading ? <p>Loading summary...</p> : null}
      {error ? <p className='error'>{error}</p> : null}

      {summary ? (
        <section className='grid grid-3'>
          <div className='card'>Total Shops: {summary.total_shops}</div>
          <div className='card'>Occupied: {summary.occupied_shops}</div>
          <div className='card'>Vacant: {summary.vacant_shops}</div>
          <div className='card'>Expected Rent: INR {summary.expected_rent_current_month.toFixed(2)}</div>
          <div className='card'>Collected: INR {summary.collected_current_month.toFixed(2)}</div>
          <div className='card'>Pending Dues: INR {summary.pending_dues_current_month.toFixed(2)}</div>
        </section>
      ) : null}

      <section className='card' style={{ marginTop: 16 }}>
        <h2>Owner-Wise Due View</h2>
        <p className='muted'>Owner-filtered summary, shop dues, and tenant dues.</p>
        <div style={{ marginTop: 8, maxWidth: 420 }}>
          <select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            style={{ width: '100%' }}
          >
            {owners.map((owner) => (
              <option key={owner.owner_id} value={owner.owner_id}>
                {owner.owner_name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setOwnerRefreshTick((v) => v + 1)} disabled={!selectedOwnerId || ownerLoading}>
            {ownerLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {ownerLoading ? <p>Loading owner due view...</p> : null}
        {ownerError ? <p className='error'>{ownerError}</p> : null}
      </section>

      {ownerDue ? (
        <>
          <section className='grid grid-3' style={{ marginTop: 16 }}>
            <div className='card'>Expected Rent: INR {ownerDue.summary.expected_rent.toFixed(2)}</div>
            <div className='card'>Collected Rent: INR {ownerDue.summary.collected_rent.toFixed(2)}</div>
            <div className='card'>Total Due: INR {ownerDue.summary.total_due.toFixed(2)}</div>
          </section>

          <section className='card' style={{ marginTop: 16 }}>
            <h3>Due Remaining Shops</h3>
            {ownerDue.due_shops.length === 0 ? (
              <p className='muted'>No shops with remaining due.</p>
            ) : (
              <div className='grid'>
                {ownerDue.due_shops.map((shop) => (
                  <div
                    key={shop.shop_id}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
                  >
                    <span>Shop {shop.shop_number}</span>
                    <strong>INR {shop.total_due.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className='card' style={{ marginTop: 16 }}>
            <h3>Tenant-Wise Due Details</h3>
            {ownerDue.tenant_dues.length === 0 ? (
              <p className='muted'>No tenants with remaining due.</p>
            ) : (
              <div className='grid'>
                {ownerDue.tenant_dues.map((tenant) => (
                  <div
                    key={`${tenant.tenant_id}-${tenant.shop_number}`}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
                  >
                    <span>
                      {tenant.tenant_name} (Shop {tenant.shop_number})
                    </span>
                    <strong>INR {tenant.total_due.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className='card' style={{ marginTop: 16 }}>
        <h2>Quick Payment</h2>
        <p className='muted'>Enter a rent ledger ID and post payment.</p>
        <input value={rentId} onChange={(e) => setRentId(e.target.value)} placeholder='Rent Ledger UUID' style={{ width: '100%', maxWidth: 420 }} />
        <div style={{ marginTop: 12 }}>{rentId ? <PaymentActions rentId={rentId} /> : null}</div>
      </section>

      <section className='card' style={{ marginTop: 16 }}>
        <h2>Report Exports</h2>
        <p className='muted'>Authenticated export downloads.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => downloadReport('owner_wise', 'pdf')}>Owner PDF</button>
          <button onClick={() => downloadReport('owner_wise', 'xlsx')}>Owner Excel</button>
          <button onClick={() => downloadReport('summary', 'pdf')}>Summary PDF</button>
          <button onClick={() => downloadReport('summary', 'xlsx')}>Summary Excel</button>
        </div>
        {downloadError ? <p className='error'>{downloadError}</p> : null}
      </section>
    </main>
  );
}
