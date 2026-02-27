import { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { buildInvoiceWhatsAppLinks } from '../services/whatsapp';

interface WhatsAppContextRow {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_month: string;
  amount_paid: string;
  remaining_due: string;
  payment_mode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
  tenant_name: string;
  tenant_phone: string;
  owner_name: string;
  owner_phone: string;
  shop_number: string;
  rent_amount: string;
  previous_due: string;
  property_name: string;
  public_token: string;
}

interface InvoiceListRow {
  invoice_id: string;
  invoice_number: string;
  invoice_month: string;
  invoice_date: string;
  amount_paid: string;
  remaining_due: string;
  payment_mode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';
  public_token: string;
  created_at: string;
}

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/invoices', { preHandler: [app.authenticate] }, async () => {
    const result = await app.db.query<InvoiceListRow>(
      `
        SELECT
          invoice_id,
          invoice_number,
          invoice_month,
          invoice_date,
          amount_paid,
          remaining_due,
          payment_mode,
          public_token,
          created_at
        FROM invoices
        ORDER BY created_at DESC
      `,
    );

    return result.rows.map((row) => ({
      invoice_id: row.invoice_id,
      invoice_number: row.invoice_number,
      invoice_month: row.invoice_month,
      invoice_date: row.invoice_date,
      amount_paid: Number(row.amount_paid),
      remaining_due: Number(row.remaining_due),
      payment_mode: row.payment_mode,
      created_at: row.created_at,
      pdf_download_url: `${env.PUBLIC_BASE_URL}/public/invoices/${row.public_token}`,
    }));
  });

  app.get('/invoices/:invoiceId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const invoiceId = (request.params as { invoiceId: string }).invoiceId;

    const result = await app.db.query(
      `
        SELECT
          i.*,
          t.tenant_name,
          o.owner_name,
          s.shop_number
        FROM invoices i
        JOIN tenants t ON t.tenant_id = i.tenant_id
        JOIN owners o ON o.owner_id = i.owner_id
        JOIN shops s ON s.shop_id = i.shop_id
        WHERE i.invoice_id = $1
      `,
      [invoiceId],
    );

    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      return reply.code(404).send({ message: 'Invoice not found' });
    }

    return {
      ...row,
      pdf_download_url: `${env.PUBLIC_BASE_URL}/public/invoices/${String(row.public_token)}`,
    };
  });

  app.get('/invoices/:invoiceId/whatsapp-links', { preHandler: [app.authenticate] }, async (request, reply) => {
    const invoiceId = (request.params as { invoiceId: string }).invoiceId;

    const result = await app.db.query<WhatsAppContextRow>(
      `
        SELECT
          i.invoice_id,
          i.invoice_number,
          i.invoice_date::text,
          i.invoice_month,
          i.amount_paid::text,
          i.remaining_due::text,
          i.payment_mode,
          i.public_token,
          t.tenant_name,
          t.whatsapp_number AS tenant_phone,
          o.owner_name,
          o.whatsapp_number AS owner_phone,
          s.shop_number,
          rl.rent_amount::text,
          rl.previous_due::text,
          st.setting_value AS property_name
        FROM invoices i
        JOIN rent_ledgers rl ON rl.rent_id = i.rent_id
        JOIN tenants t ON t.tenant_id = i.tenant_id
        JOIN owners o ON o.owner_id = i.owner_id
        JOIN shops s ON s.shop_id = i.shop_id
        JOIN app_settings st ON st.setting_key = 'property_name'
        WHERE i.invoice_id = $1
        LIMIT 1
      `,
      [invoiceId],
    );

    const row = result.rows[0];
    if (!row) {
      return reply.code(404).send({ message: 'Invoice not found' });
    }

    const publicUrl = `${env.PUBLIC_BASE_URL}/public/invoices/${row.public_token}`;
    const links = buildInvoiceWhatsAppLinks({
      tenantPhone: row.tenant_phone,
      ownerPhone: row.owner_phone,
      context: {
        propertyName: row.property_name,
        invoiceNumber: row.invoice_number,
        invoiceDate: row.invoice_date,
        rentMonth: row.invoice_month,
        tenantName: row.tenant_name,
        ownerName: row.owner_name,
        shopNumber: row.shop_number,
        monthlyRent: Number(row.rent_amount),
        previousDue: Number(row.previous_due),
        amountPaid: Number(row.amount_paid),
        remainingDue: Number(row.remaining_due),
        paymentMode: row.payment_mode,
        pdfDownloadUrl: publicUrl,
      },
    });

    return reply.send({
      tenantWaLink: links.tenantWaLink,
      ownerWaLink: links.ownerWaLink,
    });
  });
}
