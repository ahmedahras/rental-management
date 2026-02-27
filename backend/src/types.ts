export type ShopStatus = 'OCCUPIED' | 'VACANT';
export type RentPaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';

export interface QueryResult<T> {
  rows: T[];
}

export interface Tx {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface Db {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface RentLedger {
  rent_id: string;
  shop_id: string;
  tenant_id: string;
  rent_month: string;
  rent_amount: number;
  previous_due: number;
  total_due: number;
  amount_paid: number;
  remaining_due: number;
  payment_status: RentPaymentStatus;
  next_due_date: string;
}

export interface InvoiceContext {
  propertyName: string;
  invoiceNumber: string;
  invoiceDate: string;
  rentMonth: string;
  tenantName: string;
  ownerName: string;
  shopNumber: string;
  monthlyRent: number;
  previousDue: number;
  amountPaid: number;
  remainingDue: number;
  paymentMode: PaymentMode;
  pdfDownloadUrl: string;
}

export interface PaymentInput {
  rentId: string;
  amount: number;
  paymentMode: PaymentMode;
  transactionRef?: string;
  paidOn?: string;
  notes?: string;
  adminId: number;
}

export interface Invoice {
  invoice_id: string;
  invoice_number: string;
  invoice_month: string;
  invoice_sequence: number;
  rent_id: string;
  shop_id: string;
  tenant_id: string;
  owner_id: string;
  invoice_date: string;
  amount_paid: number;
  remaining_due: number;
  payment_mode: PaymentMode;
  pdf_storage_path: string;
  public_token: string;
  public_url_expires_at: string;
  created_at: string;
}
