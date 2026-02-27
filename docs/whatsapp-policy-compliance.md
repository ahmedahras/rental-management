# WhatsApp Policy Compliance (Zero-Cost Method)

## Non-Negotiable Compliance Decisions

- No WhatsApp Business API.
- No paid message gateway.
- No automated background sending.
- Only official click-to-chat links:
  - `https://wa.me/{phone}?text={encoded_message}`
- Human action required:
  - Admin must manually tap Send in WhatsApp.

## Why This Is Safe

- Uses official URL method published by WhatsApp.
- Does not bypass WhatsApp client controls.
- No bots, no unauthorized automation tools.
- Message is user-initiated final send action.

## Anti-Ban Best Practices

1. Send only rent-related transactional content.
2. Keep recipient numbers valid and consent-based.
3. Avoid repetitive spam-like loops.
4. Provide accurate invoice links and sender identity.
5. Limit retry frequency for failed opens.

## Platform Handling

- Web: open `wa.me` in new tab; WhatsApp Web/app handles target.
- Android/iOS: open `wa.me` via deep link using system URL opener.

## Required Message Templates

Tenant:
"Rent received ?
Invoice: {invoice_number}
Shop: {shop_number}
Month: {month}
Amount Paid: ?{amount}
Remaining Due: ?{due}
Download Bill:
{pdf_link}"

Owner:
"Rent collected ??
Shop: {shop_number}
Tenant: {tenant_name}
Month: {month}
Amount: ?{amount}
Bill:
{pdf_link}"
