# Backend (Fastify + PostgreSQL)

## Features implemented

- Admin auth (`/auth/login`) using JWT
- Owners, Shops, Tenants CRUD routes
- Rent cycle generation with due carry-forward
- Payment entry with ACID transaction
- Auto invoice generation on full payment (`INV-YYYY-MM-XXX`)
- Invoice PDF generation and storage
- Secure public invoice URL (`/public/invoices/:token`)
- WhatsApp click-to-chat links for tenant + owner
- Reports APIs + export to PDF and Excel (`/reports/export`)

## Setup

1. Copy env:
   - `cp .env.example .env`
2. Start PostgreSQL:
   - from repo root: `docker compose up -d`
3. Install deps:
   - from repo root: `npm install`
4. Run migration:
   - `npm run migrate -w backend`
5. Seed admin:
   - `npm run seed:admin -w backend`
6. Start API:
   - `npm run dev -w backend`

## Important endpoints

- `POST /auth/login`
- `GET /dashboard/summary`
- `POST /payments`
- `GET /invoices/:invoiceId/whatsapp-links`
- `GET /public/invoices/:token`
- `GET /reports/export?report_type=owner_wise&format=xlsx`

## WhatsApp compliance

Only official links are generated:
- `https://wa.me/{phone}?text={encoded_message}`

No background sending and no WhatsApp Business API.
