-- PostgreSQL 15+
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE shop_status AS ENUM ('OCCUPIED', 'VACANT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rent_payment_status AS ENUM ('PAID', 'PARTIAL', 'PENDING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_mode AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_recipient_type AS ENUM ('TENANT', 'OWNER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS admins (
  admin_id            BIGSERIAL PRIMARY KEY,
  username            VARCHAR(100) NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS owners (
  owner_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name          VARCHAR(150) NOT NULL,
  whatsapp_number     VARCHAR(20) NOT NULL,
  email               VARCHAR(255),
  address             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_owners_owner_name ON owners(owner_name);

CREATE TABLE IF NOT EXISTS shops (
  shop_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_number         VARCHAR(50) NOT NULL UNIQUE,
  owner_id            UUID NOT NULL REFERENCES owners(owner_id) ON DELETE RESTRICT,
  monthly_rent        NUMERIC(12,2) NOT NULL CHECK (monthly_rent >= 0),
  status              shop_status NOT NULL DEFAULT 'VACANT',
  current_tenant_id   UUID NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_shop_occupancy_consistency CHECK (
    (status = 'VACANT' AND current_tenant_id IS NULL)
    OR
    (status = 'OCCUPIED' AND current_tenant_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_name         VARCHAR(150) NOT NULL,
  whatsapp_number     VARCHAR(20) NOT NULL,
  shop_id             UUID NOT NULL REFERENCES shops(shop_id) ON DELETE RESTRICT,
  rent_start_date     DATE NOT NULL,
  agreement_end_date  DATE,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tenants_active_shop
  ON tenants(shop_id)
  WHERE is_active = TRUE;

DO $$ BEGIN
  ALTER TABLE shops
    ADD CONSTRAINT fk_shops_current_tenant
    FOREIGN KEY (current_tenant_id) REFERENCES tenants(tenant_id)
    DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS rent_ledgers (
  rent_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(shop_id) ON DELETE RESTRICT,
  tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
  rent_month          CHAR(7) NOT NULL CHECK (rent_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  rent_amount         NUMERIC(12,2) NOT NULL CHECK (rent_amount >= 0),
  previous_due        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (previous_due >= 0),
  total_due           NUMERIC(12,2) NOT NULL CHECK (total_due >= 0),
  amount_paid         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  remaining_due       NUMERIC(12,2) NOT NULL CHECK (remaining_due >= 0),
  payment_status      rent_payment_status NOT NULL DEFAULT 'PENDING',
  next_due_date       DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, rent_month)
);

CREATE INDEX IF NOT EXISTS ix_rent_ledgers_month ON rent_ledgers(rent_month);
CREATE INDEX IF NOT EXISTS ix_rent_ledgers_tenant ON rent_ledgers(tenant_id);
CREATE INDEX IF NOT EXISTS ix_rent_ledgers_status ON rent_ledgers(payment_status);

CREATE TABLE IF NOT EXISTS payment_entries (
  payment_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_id             UUID NOT NULL REFERENCES rent_ledgers(rent_id) ON DELETE RESTRICT,
  shop_id             UUID NOT NULL REFERENCES shops(shop_id) ON DELETE RESTRICT,
  tenant_id           UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
  paid_on             DATE NOT NULL DEFAULT CURRENT_DATE,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_mode        payment_mode NOT NULL,
  transaction_ref     VARCHAR(120),
  notes               TEXT,
  created_by_admin    BIGINT NOT NULL REFERENCES admins(admin_id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_payment_entries_rent ON payment_entries(rent_id);
CREATE INDEX IF NOT EXISTS ix_payment_entries_paid_on ON payment_entries(paid_on);

CREATE TABLE IF NOT EXISTS invoice_counters (
  invoice_month       CHAR(7) PRIMARY KEY CHECK (invoice_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  last_sequence       INTEGER NOT NULL CHECK (last_sequence >= 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number         VARCHAR(30) NOT NULL UNIQUE,
  invoice_month          CHAR(7) NOT NULL CHECK (invoice_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  invoice_sequence       INTEGER NOT NULL CHECK (invoice_sequence > 0),
  rent_id                UUID NOT NULL UNIQUE REFERENCES rent_ledgers(rent_id) ON DELETE RESTRICT,
  shop_id                UUID NOT NULL REFERENCES shops(shop_id) ON DELETE RESTRICT,
  tenant_id              UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
  owner_id               UUID NOT NULL REFERENCES owners(owner_id) ON DELETE RESTRICT,
  invoice_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_paid            NUMERIC(12,2) NOT NULL CHECK (amount_paid >= 0),
  remaining_due          NUMERIC(12,2) NOT NULL CHECK (remaining_due >= 0),
  payment_mode           payment_mode NOT NULL,
  pdf_storage_path       TEXT NOT NULL,
  public_token           VARCHAR(96) NOT NULL UNIQUE,
  public_url_expires_at  TIMESTAMPTZ NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_invoices_month ON invoices(invoice_month);

CREATE TABLE IF NOT EXISTS whatsapp_dispatches (
  dispatch_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  recipient_type      whatsapp_recipient_type NOT NULL,
  recipient_phone     VARCHAR(20) NOT NULL,
  wa_link             TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key         VARCHAR(100) PRIMARY KEY,
  setting_value       TEXT NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings(setting_key, setting_value)
VALUES ('property_name', 'Default Building')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO owners(owner_name, whatsapp_number, email, address)
VALUES
  ('U Fathima', '9000000001', NULL, NULL),
  ('Afsal', '9000000002', NULL, NULL),
  ('Hafeez', '9000000003', NULL, NULL),
  ('Riyaz', '9000000004', NULL, NULL),
  ('Shamin', '9000000005', NULL, NULL)
ON CONFLICT (owner_name) DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_admins_updated
    BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_owners_updated
    BEFORE UPDATE ON owners
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_shops_updated
    BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tenants_updated
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_rent_ledgers_updated
    BEFORE UPDATE ON rent_ledgers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION validate_shop_current_tenant()
RETURNS TRIGGER AS $$
DECLARE
  tenant_shop UUID;
BEGIN
  IF NEW.current_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT shop_id INTO tenant_shop
  FROM tenants
  WHERE tenant_id = NEW.current_tenant_id;

  IF tenant_shop IS NULL THEN
    RAISE EXCEPTION 'Current tenant does not exist';
  END IF;

  IF tenant_shop <> NEW.shop_id THEN
    RAISE EXCEPTION 'Current tenant must belong to same shop';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_validate_shop_current_tenant
    BEFORE INSERT OR UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION validate_shop_current_tenant();
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION upsert_monthly_rent_cycle(p_month CHAR(7), p_next_due_date DATE)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  WITH previous_month_dues AS (
    SELECT
      rl.shop_id,
      rl.remaining_due
    FROM rent_ledgers rl
    WHERE rl.rent_month = to_char((to_date(p_month || '-01', 'YYYY-MM-DD') - interval '1 month'), 'YYYY-MM')
  ),
  inserted AS (
    INSERT INTO rent_ledgers (
      shop_id,
      tenant_id,
      rent_month,
      rent_amount,
      previous_due,
      total_due,
      amount_paid,
      remaining_due,
      payment_status,
      next_due_date
    )
    SELECT
      s.shop_id,
      s.current_tenant_id,
      p_month,
      s.monthly_rent,
      COALESCE(pm.remaining_due, 0),
      s.monthly_rent + COALESCE(pm.remaining_due, 0),
      0,
      s.monthly_rent + COALESCE(pm.remaining_due, 0),
      'PENDING',
      p_next_due_date
    FROM shops s
    LEFT JOIN previous_month_dues pm ON pm.shop_id = s.shop_id
    WHERE s.status = 'OCCUPIED'
      AND s.current_tenant_id IS NOT NULL
    ON CONFLICT (shop_id, rent_month) DO NOTHING
    RETURNING rent_id
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;
