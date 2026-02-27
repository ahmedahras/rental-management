import { Db, Invoice, PaymentInput, PaymentMode, RentLedger } from '../types';
import { buildInvoiceWhatsAppLinks, buildPaymentUpdateWhatsAppLinks } from './whatsapp';
import { createInvoiceForPaidLedger } from './invoice.service';

interface RentLedgerRow {
  rent_id: string;
  shop_id: string;
  tenant_id: string;
  rent_month: string;
  rent_amount: string;
  previous_due: string;
  total_due: string;
  amount_paid: string;
  remaining_due: string;
  payment_status: 'PAID' | 'PARTIAL' | 'PENDING';
  next_due_date: string;
}

interface PaymentRow {
  payment_id: string;
  rent_id: string;
  shop_id: string;
  tenant_id: string;
  paid_on: string;
  amount: string;
  payment_mode: PaymentMode;
  transaction_ref: string | null;
}

interface PaymentContextRow {
  rent_month: string;
  shop_number: string;
  tenant_name: string;
  tenant_phone: string;
  owner_name: string;
  owner_phone: string;
}

function toNumber(value: string): number {
  return Number(value);
}

function toRentLedger(row: RentLedgerRow): RentLedger {
  return {
    rent_id: row.rent_id,
    shop_id: row.shop_id,
    tenant_id: row.tenant_id,
    rent_month: row.rent_month,
    rent_amount: toNumber(row.rent_amount),
    previous_due: toNumber(row.previous_due),
    total_due: toNumber(row.total_due),
    amount_paid: toNumber(row.amount_paid),
    remaining_due: toNumber(row.remaining_due),
    payment_status: row.payment_status,
    next_due_date: row.next_due_date,
  };
}

export class PaymentService {
  constructor(
    private readonly db: Db,
    private readonly publicBaseUrl: string,
    private readonly invoiceStorageRoot: string,
  ) {}

  async enterPayment(input: PaymentInput): Promise<{
    payment: PaymentRow;
    rentLedger: RentLedger;
    invoice: Invoice | null;
    whatsappLinks: { tenantWaLink: string; ownerWaLink: string } | null;
  }> {
    return this.db.withTransaction(async (tx) => {
      const rentRes = await tx.query<RentLedgerRow>(
        `SELECT * FROM rent_ledgers WHERE rent_id = $1 FOR UPDATE`,
        [input.rentId],
      );
      const rent = rentRes.rows[0];
      if (!rent) {
        throw new Error('Rent ledger not found');
      }

      const totalDue = toNumber(rent.total_due);
      const currentPaid = toNumber(rent.amount_paid);
      const nextPaid = currentPaid + input.amount;
      if (nextPaid - totalDue > 0.001) {
        throw new Error('Paid amount exceeds total due');
      }

      const remainingDue = Math.max(totalDue - nextPaid, 0);
      const status = remainingDue === 0 ? 'PAID' : nextPaid > 0 ? 'PARTIAL' : 'PENDING';

      const paymentRes = await tx.query<PaymentRow>(
        `
          INSERT INTO payment_entries (
            rent_id, shop_id, tenant_id, paid_on, amount,
            payment_mode, transaction_ref, notes, created_by_admin
          ) VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6, $7, $8, $9)
          RETURNING payment_id, rent_id, shop_id, tenant_id, paid_on, amount::text, payment_mode, transaction_ref
        `,
        [
          rent.rent_id,
          rent.shop_id,
          rent.tenant_id,
          input.paidOn ?? null,
          input.amount,
          input.paymentMode,
          input.transactionRef ?? null,
          input.notes ?? null,
          input.adminId,
        ],
      );

      const updatedRentRes = await tx.query<RentLedgerRow>(
        `
          UPDATE rent_ledgers
          SET
            amount_paid = $2,
            remaining_due = $3,
            payment_status = $4,
            updated_at = NOW()
          WHERE rent_id = $1
          RETURNING *
        `,
        [rent.rent_id, nextPaid, remainingDue, status],
      );

      const updatedRent = toRentLedger(updatedRentRes.rows[0]);
      const paymentContextRes = await tx.query<PaymentContextRow>(
        `
          SELECT
            rl.rent_month,
            s.shop_number,
            t.tenant_name,
            t.whatsapp_number AS tenant_phone,
            o.owner_name,
            o.whatsapp_number AS owner_phone
          FROM rent_ledgers rl
          JOIN shops s ON s.shop_id = rl.shop_id
          JOIN tenants t ON t.tenant_id = rl.tenant_id
          JOIN owners o ON o.owner_id = s.owner_id
          WHERE rl.rent_id = $1
          LIMIT 1
        `,
        [rent.rent_id],
      );
      const paymentContext = paymentContextRes.rows[0];
      if (!paymentContext) {
        throw new Error('Payment context not found');
      }

      await tx.query(`SELECT refresh_monthly_summary_tables()`);

      if (status !== 'PAID') {
        const links = buildPaymentUpdateWhatsAppLinks({
          tenantPhone: paymentContext.tenant_phone,
          ownerPhone: paymentContext.owner_phone,
          context: {
            tenantName: paymentContext.tenant_name,
            ownerName: paymentContext.owner_name,
            shopNumber: paymentContext.shop_number,
            rentMonth: paymentContext.rent_month,
            amountPaid: input.amount,
            remainingDue,
            status,
          },
        });

        return {
          payment: paymentRes.rows[0],
          rentLedger: updatedRent,
          invoice: null,
          whatsappLinks: {
            tenantWaLink: links.tenantWaLink,
            ownerWaLink: links.ownerWaLink,
          },
        };
      }

      const invoiceResult = await createInvoiceForPaidLedger(tx, {
        rentId: rent.rent_id,
        paymentMode: input.paymentMode,
        amountPaid: nextPaid,
        remainingDue,
        publicBaseUrl: this.publicBaseUrl,
        storageRoot: this.invoiceStorageRoot,
      });

      const links = buildInvoiceWhatsAppLinks({
        tenantPhone: invoiceResult.tenantPhone,
        ownerPhone: invoiceResult.ownerPhone,
        context: {
          propertyName: invoiceResult.propertyName,
          invoiceNumber: invoiceResult.invoice.invoice_number,
          invoiceDate: invoiceResult.invoice.invoice_date,
          rentMonth: invoiceResult.month,
          tenantName: invoiceResult.tenantName,
          ownerName: invoiceResult.ownerName,
          shopNumber: invoiceResult.shopNumber,
          monthlyRent: invoiceResult.monthlyRent,
          previousDue: invoiceResult.previousDue,
          amountPaid: nextPaid,
          remainingDue,
          paymentMode: input.paymentMode,
          pdfDownloadUrl: `${this.publicBaseUrl}/public/invoices/${invoiceResult.invoice.public_token}`,
        },
      });

      await tx.query(
        `
          INSERT INTO whatsapp_dispatches (invoice_id, recipient_type, recipient_phone, wa_link)
          VALUES
            ($1, 'TENANT', $2, $3),
            ($1, 'OWNER', $4, $5)
        `,
        [
          invoiceResult.invoice.invoice_id,
          invoiceResult.tenantPhone,
          links.tenantWaLink,
          invoiceResult.ownerPhone,
          links.ownerWaLink,
        ],
      );

      return {
        payment: paymentRes.rows[0],
        rentLedger: updatedRent,
        invoice: invoiceResult.invoice,
        whatsappLinks: {
          tenantWaLink: links.tenantWaLink,
          ownerWaLink: links.ownerWaLink,
        },
      };
    });
  }
}
