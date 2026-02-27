# System Architecture

## 1. Platforms

- Web: Next.js app (responsive + PWA-ready)
- Mobile: React Native app for Android + iOS
- Backend: Node.js + TypeScript REST API
- Database: PostgreSQL
- File Storage: local/NAS/S3-compatible storage for PDFs

## 2. High-Level Components

1. `Client Apps`
- Admin login
- Owners/Shops/Tenants CRUD
- Rent list and payment entry
- One-tap open WhatsApp links for tenant/owner

2. `API Layer`
- JWT auth (single admin)
- Validation + rate limiting
- REST endpoints for all modules

3. `Domain Services`
- Rent cycle generation and due carry-forward
- Payment reconciliation
- Invoice number sequencing
- Invoice PDF rendering
- WhatsApp click-to-chat message/link generation

4. `Persistence`
- PostgreSQL tables with indexes and constraints
- ACID transaction for payment -> invoice -> WhatsApp metadata

## 3. Authentication Model

- Single admin account in `admins` table.
- `/auth/login` returns JWT.
- Same credentials for web and mobile.
- No owner/tenant login.

## 4. Data Consistency Rules

- One active tenant per shop via partial unique index.
- One rent ledger per shop per month via unique constraint.
- Invoice number uniqueness by DB unique index and month counter table.
- Payment processing uses row lock on `rent_ledgers` to avoid race conditions.

## 5. Scalability for 200+ Shops

- Indexed query paths for month/status/shop/owner/tenant.
- Monthly rent generation as set-based SQL function (`upsert_monthly_rent_cycle`).
- Paginated list endpoints.
- Background jobs for non-critical exports.

## 6. Security

- Password hashing (Argon2id recommended).
- JWT expiration and refresh strategy.
- Strict input validation (Zod/Joi recommended).
- Signed or random-token public invoice URL.
- Audit logs for payments and invoice access.

## 7. Deployment Layout

- API + Web on containerized services.
- Mobile builds via CI (Android APK/AAB, iOS TestFlight).
- PostgreSQL managed instance with daily backups.
- Invoice storage bucket/directory with immutable paths.
