import crypto from 'node:crypto';
import path from 'node:path';
import { Invoice, PaymentMode, Tx } from '../types';
import { renderInvoicePdf } from './invoice-pdf.service';

interface CreateInvoiceInput {
  rentId: string;
  paymentMode: PaymentMode;
  amountPaid: number;
  remainingDue: number;
  publicBaseUrl: string;
  storageRoot: string;
}

interface InvoiceJoinRow {
  rent_id: string;
  rent_month: string;
  rent_amount: string;
  previous_due: string;
  shop_id: string;
  shop_number: string;
  tenant_id: string;
  tenant_name: string;
  tenant_phone: string;
  owner_id: string;
  owner_name: string;
  owner_phone: string;
  property_name: string;
}

async function getNextInvoiceNumber(tx: Tx, month: string): Promise<{ invoiceNumber: string; sequence: number }> {
  const seqRes = await tx.query<{ last_sequence: number }>(
    `
      INSERT INTO invoice_counters(invoice_month, last_sequence)
      VALUES ($1, 1)
      ON CONFLICT (invoice_month)
      DO UPDATE SET last_sequence = invoice_counters.last_sequence + 1, updated_at = NOW()
      RETURNING last_sequence
    `,
    [month],
  );

  const sequence = seqRes.rows[0].last_sequence;
  const suffix = sequence.toString().padStart(3, '0');
  return { invoiceNumber: `INV-${month}-${suffix}`, sequence };
}

export async function createInvoiceForPaidLedger(
  tx: Tx,
  input: CreateInvoiceInput,
): Promise<{
  invoice: Invoice;
  tenantPhone: string;
  ownerPhone: string;
  tenantName: string;
  ownerName: string;
  propertyName: string;
  shopNumber: string;
  month: string;
  monthlyRent: number;
  previousDue: number;
}> {
  const existing = await tx.query<Invoice>(
    `SELECT * FROM invoices WHERE rent_id = $1`,
    [input.rentId],
  );
  if (existing.rows[0]) {
    const fallback = await tx.query<InvoiceJoinRow>(
      `
        SELECT
          rl.rent_id,
          rl.rent_month,
          rl.rent_amount::text,
          rl.previous_due::text,
          s.shop_id,
          s.shop_number,
          t.tenant_id,
          t.tenant_name,
          t.whatsapp_number AS tenant_phone,
          o.owner_id,
          o.owner_name,
          o.whatsapp_number AS owner_phone,
          st.setting_value AS property_name
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        JOIN owners o ON o.owner_id = s.owner_id
        JOIN app_settings st ON st.setting_key = 'property_name'
        WHERE rl.rent_id = $1
      `,
      [input.rentId],
    );

    return {
      invoice: existing.rows[0],
      tenantPhone: fallback.rows[0].tenant_phone,
      ownerPhone: fallback.rows[0].owner_phone,
      tenantName: fallback.rows[0].tenant_name,
      ownerName: fallback.rows[0].owner_name,
      propertyName: fallback.rows[0].property_name,
      shopNumber: fallback.rows[0].shop_number,
      month: fallback.rows[0].rent_month,
      monthlyRent: Number(fallback.rows[0].rent_amount),
      previousDue: Number(fallback.rows[0].previous_due),
    };
  }

  const rowRes = await tx.query<InvoiceJoinRow>(
    `
      SELECT
        rl.rent_id,
        rl.rent_month,
        rl.rent_amount::text,
        rl.previous_due::text,
        s.shop_id,
        s.shop_number,
        t.tenant_id,
        t.tenant_name,
        t.whatsapp_number AS tenant_phone,
        o.owner_id,
        o.owner_name,
        o.whatsapp_number AS owner_phone,
        st.setting_value AS property_name
      FROM rent_ledgers rl
      JOIN shops s ON s.shop_id = rl.shop_id
      JOIN tenants t ON t.tenant_id = rl.tenant_id
      JOIN owners o ON o.owner_id = s.owner_id
      JOIN app_settings st ON st.setting_key = 'property_name'
      WHERE rl.rent_id = $1
      LIMIT 1
    `,
    [input.rentId],
  );

  const row = rowRes.rows[0];
  if (!row) {
    throw new Error('Rent ledger not found for invoice generation');
  }

  const { invoiceNumber, sequence } = await getNextInvoiceNumber(tx, row.rent_month);
  const publicToken = crypto.randomBytes(32).toString('hex');
  const publicUrl = `${input.publicBaseUrl}/public/invoices/${publicToken}`;
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const storagePath = path.join(input.storageRoot, row.rent_month, `${invoiceNumber}.pdf`);

  await renderInvoicePdf(
    {
      propertyName: row.property_name,
      invoiceNumber,
      invoiceDate,
      rentMonth: row.rent_month,
      tenantName: row.tenant_name,
      ownerName: row.owner_name,
      shopNumber: row.shop_number,
      monthlyRent: Number(row.rent_amount),
      previousDue: Number(row.previous_due),
      amountPaid: input.amountPaid,
      remainingDue: input.remainingDue,
      paymentMode: input.paymentMode,
      pdfDownloadUrl: publicUrl,
    },
    storagePath,
  );

  const invoiceRes = await tx.query<Invoice>(
    `
      INSERT INTO invoices (
        invoice_number,
        invoice_month,
        invoice_sequence,
        rent_id,
        shop_id,
        tenant_id,
        owner_id,
        invoice_date,
        amount_paid,
        remaining_due,
        payment_mode,
        pdf_storage_path,
        public_token,
        public_url_expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        CURRENT_DATE,
        $8, $9, $10, $11, $12,
        NOW() + INTERVAL '10 years'
      )
      RETURNING *
    `,
    [
      invoiceNumber,
      row.rent_month,
      sequence,
      row.rent_id,
      row.shop_id,
      row.tenant_id,
      row.owner_id,
      input.amountPaid,
      input.remainingDue,
      input.paymentMode,
      storagePath,
      publicToken,
    ],
  );

  return {
    invoice: invoiceRes.rows[0],
    tenantPhone: row.tenant_phone,
    ownerPhone: row.owner_phone,
    tenantName: row.tenant_name,
    ownerName: row.owner_name,
    propertyName: row.property_name,
    shopNumber: row.shop_number,
    month: row.rent_month,
    monthlyRent: Number(row.rent_amount),
    previousDue: Number(row.previous_due),
  };
}
