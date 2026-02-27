# End-to-End Flow: Payment -> Invoice -> WhatsApp

## A. Monthly Rent Cycle Generation

Input:
- `month` (`YYYY-MM`)
- `next_due_date`

Process:
1. Select all `shops` where `status = OCCUPIED`.
2. Read previous month `remaining_due` per shop.
3. Insert `rent_ledgers` for current month with:
- `rent_amount = monthly_rent`
- `previous_due = carry_forward_due`
- `total_due = rent_amount + previous_due`
- `amount_paid = 0`
- `remaining_due = total_due`
- `payment_status = PENDING`

## B. Admin Payment Entry

Input:
- `rent_id`
- `amount`
- `payment_mode`
- optional reference/notes/date

Transaction steps:
1. `SELECT ... FOR UPDATE` on rent ledger row.
2. Insert `payment_entries` row.
3. Recompute:
- `amount_paid = old_amount_paid + payment`
- `remaining_due = total_due - amount_paid`
- `payment_status = PAID if remaining_due = 0 else PARTIAL`
4. Update rent ledger.

## C. Invoice Auto Generation (only when status becomes PAID)

1. Get month counter from `invoice_counters` using upsert increment.
2. Build invoice number: `INV-YYYY-MM-XXX`.
3. Render invoice PDF with required fields.
4. Store PDF path on server.
5. Create public token and secure URL (`/public/invoices/{token}`).
6. Insert `invoices` record.

## D. WhatsApp Link Generation (Zero Cost)

No API sending.

1. Build tenant message:
"Rent received ?\nInvoice: ..."
2. Build owner message:
"Rent collected ??\nShop: ..."
3. Encode and create links:
- `https://wa.me/{tenant_phone}?text={encoded}`
- `https://wa.me/{owner_phone}?text={encoded}`
4. Return both links in payment API response.
5. Web/mobile opens WhatsApp. Admin manually taps Send.

## E. Failure Safety

- If invoice generation fails, rollback entire transaction.
- If WhatsApp link generation fails, return payment + invoice success and allow manual link regeneration endpoint.
- If duplicate payment attempt occurs, row lock + recomputation prevents double-close race.

## F. Financial Accuracy

Rules:
- Use `NUMERIC(12,2)` in DB.
- Never compute monetary values using float in DB logic.
- Reject overpayments unless explicit business rule allows credit handling.
