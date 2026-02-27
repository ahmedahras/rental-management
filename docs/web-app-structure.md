# Web App Structure (Responsive + PWA)

## Suggested Stack

- Next.js 14+ (App Router)
- TypeScript
- TanStack Query for data fetching
- Form validation with Zod + React Hook Form
- PWA plugin (`next-pwa`) for installability

## Route Map

- `/login`
- `/dashboard`
- `/owners`
- `/owners/[ownerId]`
- `/shops`
- `/shops/[shopId]`
- `/tenants`
- `/tenants/[tenantId]`
- `/rents?month=YYYY-MM`
- `/payments/new`
- `/invoices`
- `/reports`

## Key Screens

1. Dashboard
- Total shops
- Occupied/vacant
- Expected rent
- Collected
- Pending dues

2. Rent List
- Month filter
- Status chips (PAID/PARTIAL/PENDING)
- Quick action buttons:
  - Mark as Paid
  - Send Bill to Tenant
  - Send Bill to Owner

3. Payment Form
- Amount
- Payment mode
- Transaction reference
- Submit to `/payments`

4. Invoice List
- Download PDF
- Regenerate WhatsApp links

## PWA Requirements

- `manifest.json`
- Service worker cache policy for shell + API-safe caching rules
- Install prompt for Android/desktop
- Offline queue for form submissions and retry on reconnect

## UX Requirements

- Mobile responsive table alternatives (cards)
- Fast keyboard-first data entry
- Validation and inline error messaging
