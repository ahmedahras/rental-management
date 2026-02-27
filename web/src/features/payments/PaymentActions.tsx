'use client';

import { useState } from 'react';
import { openWhatsApp } from '../../lib/whatsapp';
import { apiFetch } from '../../lib/api';

type Props = {
  rentId: string;
};

type PaymentResponse = {
  invoice: { invoice_number: string; public_token: string } | null;
  whatsapp_links: { tenantWaLink: string; ownerWaLink: string } | null;
};

export function PaymentActions({ rentId }: Props): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [tenantLink, setTenantLink] = useState<string | null>(null);
  const [ownerLink, setOwnerLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markPaid(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PaymentResponse>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          rent_id: rentId,
          amount: Number(amount),
          payment_mode: paymentMode,
        }),
      });
      setTenantLink(data.whatsapp_links?.tenantWaLink ?? null);
      setOwnerLink(data.whatsapp_links?.ownerWaLink ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder='Amount'
        inputMode='decimal'
      />
      <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}>
        <option value='CASH'>Cash</option>
        <option value='UPI'>UPI</option>
        <option value='BANK_TRANSFER'>Bank Transfer</option>
        <option value='CHEQUE'>Cheque</option>
      </select>
      <button onClick={markPaid} disabled={loading}>
        Mark as Paid
      </button>
      <button onClick={() => tenantLink && openWhatsApp(tenantLink)} disabled={!tenantLink}>
        Send Bill to Tenant
      </button>
      <button onClick={() => ownerLink && openWhatsApp(ownerLink)} disabled={!ownerLink}>
        Send Bill to Owner
      </button>
      {error ? <div className='error'>{error}</div> : null}
    </div>
  );
}
