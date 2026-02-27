# Shop Management System

Production-oriented monorepo for:
- Android app (Flutter)
- iOS app (Flutter)
- Web app (Next.js, responsive + PWA manifest)
- Backend REST API (Fastify + TypeScript)
- PostgreSQL relational database

## Key Business Guarantees

- Dynamic number of shops and owners
- One active tenant per shop
- Single admin login for all platforms
- Monthly rent cycle with carry-forward dues
- Payment -> invoice auto-generation when status becomes `PAID`
- Unique sequential invoice number: `INV-YYYY-MM-XXX`
- PDF invoice storage + secure public token URL
- WhatsApp messaging uses zero-cost official click-to-chat only

## WhatsApp Compliance (Zero Cost)

Implemented using only:
- `https://wa.me/{phone}?text={encoded_message}`

No WhatsApp Business API, no paid gateways, no background sending.
Admin performs one manual Send tap in WhatsApp.

## Project Structure

- `backend/` Fastify API + SQL schema + services
- `web/` Next.js admin web app
- `mobile_flutter/` Flutter app for Android/iOS
- `docs/` architecture, API, DB, workflow docs

## Quick Start

1. Install dependencies:
   - `npm install`
2. Start Postgres:
   - `docker compose up -d`
3. Configure backend env:
   - copy `backend/.env.example` to `backend/.env`
4. Run schema migration:
   - `npm run migrate -w backend`
5. Seed single admin user:
   - `npm run seed:admin -w backend`
6. Run backend:
   - `npm run dev -w backend`
7. Run web:
   - `npm run dev -w web`
8. Run mobile:
   - `cd mobile_flutter && flutter run --dart-define=API_BASE_URL=http://localhost:4000`

## Critical API Endpoints

- `POST /auth/login`
- `POST /rent-cycles/generate`
- `POST /payments`
- `GET /invoices/:invoiceId/whatsapp-links`
- `GET /public/invoices/:token`
- `GET /reports/export?report_type=owner_wise&format=pdf`

## Deliverables Included

- Database schema: `docs/database-schema.sql`
- API contract: `docs/api-design.yaml`
- End-to-end flow: `docs/end-to-end-flow.md`
- Web structure: `docs/web-app-structure.md`
- Mobile structure: `docs/mobile-app-structure.md`
- WhatsApp compliance note: `docs/whatsapp-policy-compliance.md`
