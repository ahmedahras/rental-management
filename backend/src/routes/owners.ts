import { FastifyInstance } from 'fastify';

const FIXED_OWNER_NAMES = ['U Fathima', 'Afsal', 'Hafeez', 'Riyaz', 'Shamin'] as const;

interface OwnerRow {
  owner_id: string;
  owner_name: string;
  whatsapp_number: string;
  email: string | null;
  address: string | null;
}

interface OwnerSummaryRow {
  expected_rent: string;
  collected_rent: string;
  total_shops: string;
  occupied_shops: string;
  vacant_shops: string;
}

interface OwnerDueSummaryRow {
  expected_rent: string;
  collected_rent: string;
  total_due: string;
}

interface OwnerDueShopRow {
  shop_id: string;
  shop_number: string;
  shop_name: string | null;
  total_due: string;
}

interface OwnerTenantDueRow {
  tenant_id: string;
  tenant_name: string;
  shop_number: string;
  shop_name: string | null;
  total_due: string;
}

interface OwnerPendingRentRow {
  rent_id: string;
  shop_id: string;
  tenant_id: string;
  month: string;
  rent_amount: string;
  previous_due: string;
  total_due: string;
  amount_paid: string;
  remaining_due: string;
  payment_status: 'PAID' | 'PARTIAL' | 'PENDING';
  next_due_date: string;
  shop_number: string;
  shop_name: string | null;
  tenant_name: string;
}

export async function ownerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/owners', { preHandler: [app.authenticate] }, async () => {
    const result = await app.db.query<OwnerRow>(
      `
        SELECT owner_id, owner_name, whatsapp_number, email, address
        FROM owners
        WHERE owner_name = ANY($1::text[])
        ORDER BY array_position($1::text[], owner_name)
      `,
      [FIXED_OWNER_NAMES],
    );
    return result.rows;
  });

  app.post('/owners', { preHandler: [app.authenticate] }, async (_request, reply) => {
    return reply.code(403).send({ message: 'Owners are predefined and cannot be created manually' });
  });

  app.patch('/owners/:ownerId', { preHandler: [app.authenticate] }, async (_request, reply) => {
    return reply.code(403).send({ message: 'Owners are predefined and cannot be edited manually' });
  });

  app.delete('/owners/:ownerId', { preHandler: [app.authenticate] }, async (_request, reply) => {
    return reply.code(403).send({ message: 'Owners are predefined and cannot be deleted manually' });
  });

  app.get('/owners/:ownerId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const ownerId = (request.params as { ownerId: string }).ownerId;
    const result = await app.db.query<OwnerRow>(
      `
        SELECT owner_id, owner_name, whatsapp_number, email, address
        FROM owners
        WHERE owner_id = $1
          AND owner_name = ANY($2::text[])
      `,
      [ownerId, FIXED_OWNER_NAMES],
    );
    const row = result.rows[0];
    if (!row) {
      return reply.code(404).send({ message: 'Owner not found' });
    }
    return row;
  });

  app.get('/owners/:ownerId/shops', { preHandler: [app.authenticate] }, async (request) => {
    const ownerId = (request.params as { ownerId: string }).ownerId;
    const result = await app.db.query(
      `
        SELECT shop_id, shop_number, owner_id, monthly_rent, status, current_tenant_id
        FROM shops
        WHERE owner_id = $1
        ORDER BY shop_number
      `,
      [ownerId],
    );
    return result.rows;
  });

  app.get('/owners/:ownerId/summary', { preHandler: [app.authenticate] }, async (request, reply) => {
    const ownerId = (request.params as { ownerId: string }).ownerId;
    const query = request.query as { month?: string };

    const month = query.month ?? new Date().toISOString().slice(0, 7);

    const owner = await app.db.query<{ owner_name: string }>(
      `
        SELECT owner_name
        FROM owners
        WHERE owner_id = $1
          AND owner_name = ANY($2::text[])
      `,
      [ownerId, FIXED_OWNER_NAMES],
    );

    if (!owner.rows[0]) {
      return reply.code(404).send({ message: 'Owner not found' });
    }

    const result = await app.db.query<OwnerSummaryRow>(
      `
        SELECT
          COALESCE((SELECT SUM(monthly_rent) FROM shops WHERE owner_id = $1), 0)::text AS expected_rent,
          COALESCE((
            SELECT SUM(rl.amount_paid)
            FROM rent_ledgers rl
            JOIN shops s ON s.shop_id = rl.shop_id
            WHERE s.owner_id = $1
              AND rl.rent_month = $2
              AND rl.payment_status = 'PAID'
          ), 0)::text AS collected_rent,
          (SELECT COUNT(*) FROM shops WHERE owner_id = $1)::text AS total_shops,
          (SELECT COUNT(*) FROM shops WHERE owner_id = $1 AND status = 'OCCUPIED')::text AS occupied_shops,
          (SELECT COUNT(*) FROM shops WHERE owner_id = $1 AND status = 'VACANT')::text AS vacant_shops
      `,
      [ownerId, month],
    );

    const row = result.rows[0];
    const expected = Number(row.expected_rent);
    const collected = Number(row.collected_rent);

    return {
      owner_id: ownerId,
      owner_name: owner.rows[0].owner_name,
      month,
      expected_rent: expected,
      collected_rent: collected,
      pending_rent: expected - collected,
      total_shops: Number(row.total_shops),
      occupied_shops: Number(row.occupied_shops),
      vacant_shops: Number(row.vacant_shops),
    };
  });

  app.get('/owners/:ownerId/due-breakdown', { preHandler: [app.authenticate] }, async (request, reply) => {
    const ownerId = (request.params as { ownerId: string }).ownerId;

    const owner = await app.db.query<{ owner_id: string; owner_name: string }>(
      `
        SELECT owner_id, owner_name
        FROM owners
        WHERE owner_id = $1
          AND owner_name = ANY($2::text[])
      `,
      [ownerId, FIXED_OWNER_NAMES],
    );

    if (!owner.rows[0]) {
      return reply.code(404).send({ message: 'Owner not found' });
    }

    const summaryResult = await app.db.query<OwnerDueSummaryRow>(
      `
        WITH owned_shops AS (
          SELECT shop_id
          FROM shops
          WHERE owner_id = $1
        ),
        owner_rents AS (
          SELECT rl.total_due, rl.amount_paid, rl.remaining_due
          FROM rent_ledgers rl
          JOIN owned_shops os ON os.shop_id = rl.shop_id
          JOIN tenants t ON t.tenant_id = rl.tenant_id AND t.shop_id = os.shop_id
        )
        SELECT
          COALESCE(SUM(total_due), 0)::text AS expected_rent,
          COALESCE(SUM(amount_paid), 0)::text AS collected_rent,
          COALESCE(SUM(remaining_due), 0)::text AS total_due
        FROM owner_rents
      `,
      [ownerId],
    );

    const dueShopsResult = await app.db.query<OwnerDueShopRow>(
      `
        WITH owned_shops AS (
          SELECT shop_id, shop_number, shop_name
          FROM shops
          WHERE owner_id = $1
        ),
        owner_rents AS (
          SELECT rl.shop_id, rl.tenant_id, rl.remaining_due
          FROM rent_ledgers rl
          JOIN owned_shops os ON os.shop_id = rl.shop_id
          JOIN tenants t ON t.tenant_id = rl.tenant_id AND t.shop_id = os.shop_id
          WHERE rl.remaining_due > 0
        )
        SELECT
          os.shop_id,
          os.shop_number,
          os.shop_name,
          COALESCE(SUM(orx.remaining_due), 0)::text AS total_due
        FROM owner_rents orx
        JOIN owned_shops os ON os.shop_id = orx.shop_id
        GROUP BY os.shop_id, os.shop_number, os.shop_name
        HAVING COALESCE(SUM(orx.remaining_due), 0) > 0
        ORDER BY os.shop_number ASC
      `,
      [ownerId],
    );

    const tenantDueResult = await app.db.query<OwnerTenantDueRow>(
      `
        WITH owned_shops AS (
          SELECT shop_id, shop_number, shop_name
          FROM shops
          WHERE owner_id = $1
        ),
        owner_rents AS (
          SELECT rl.shop_id, rl.tenant_id, rl.remaining_due
          FROM rent_ledgers rl
          JOIN owned_shops os ON os.shop_id = rl.shop_id
          JOIN tenants t ON t.tenant_id = rl.tenant_id AND t.shop_id = os.shop_id
          WHERE rl.remaining_due > 0
        )
        SELECT
          t.tenant_id,
          t.tenant_name,
          os.shop_number,
          os.shop_name,
          COALESCE(SUM(orx.remaining_due), 0)::text AS total_due
        FROM owner_rents orx
        JOIN tenants t ON t.tenant_id = orx.tenant_id
        JOIN owned_shops os ON os.shop_id = orx.shop_id
        GROUP BY t.tenant_id, t.tenant_name, os.shop_number, os.shop_name
        HAVING COALESCE(SUM(orx.remaining_due), 0) > 0
        ORDER BY t.tenant_name ASC, os.shop_number ASC
      `,
      [ownerId],
    );

    const summary = summaryResult.rows[0];

    return {
      owner_id: owner.rows[0].owner_id,
      owner_name: owner.rows[0].owner_name,
      summary: {
        expected_rent: Number(summary.expected_rent),
        collected_rent: Number(summary.collected_rent),
        total_due: Number(summary.total_due),
      },
      due_shops: dueShopsResult.rows.map((row) => ({
        shop_id: row.shop_id,
        shop_number: row.shop_number,
        shop_name: row.shop_name,
        total_due: Number(row.total_due),
      })),
      tenant_dues: tenantDueResult.rows.map((row) => ({
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        shop_number: row.shop_number,
        shop_name: row.shop_name,
        total_due: Number(row.total_due),
      })),
    };
  });

  app.get('/owners/:ownerId/report', { preHandler: [app.authenticate] }, async (request) => {
    const ownerId = (request.params as { ownerId: string }).ownerId;
    const query = request.query as { from_month?: string; to_month?: string };

    const result = await app.db.query(
      `
        SELECT
          rl.rent_month,
          COUNT(*) AS total_ledgers,
          COALESCE(SUM(rl.total_due), 0)::numeric(12,2) AS total_due,
          COALESCE(SUM(rl.amount_paid), 0)::numeric(12,2) AS total_collected,
          COALESCE(SUM(rl.remaining_due), 0)::numeric(12,2) AS total_pending
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        WHERE s.owner_id = $1
          AND ($2::text IS NULL OR rl.rent_month >= $2)
          AND ($3::text IS NULL OR rl.rent_month <= $3)
        GROUP BY rl.rent_month
        ORDER BY rl.rent_month DESC
      `,
      [ownerId, query.from_month ?? null, query.to_month ?? null],
    );

    return result.rows;
  });

  app.get('/owners/:ownerId/pending-rents', { preHandler: [app.authenticate] }, async (request, reply) => {
    const ownerId = (request.params as { ownerId: string }).ownerId;

    const owner = await app.db.query<{ owner_id: string }>(
      `
        SELECT owner_id
        FROM owners
        WHERE owner_id = $1
          AND owner_name = ANY($2::text[])
      `,
      [ownerId, FIXED_OWNER_NAMES],
    );

    if (!owner.rows[0]) {
      return reply.code(404).send({ message: 'Owner not found' });
    }

    const result = await app.db.query<OwnerPendingRentRow>(
      `
        SELECT
          rl.rent_id,
          rl.shop_id,
          rl.tenant_id,
          rl.rent_month AS month,
          rl.rent_amount::text,
          rl.previous_due::text,
          rl.total_due::text,
          rl.amount_paid::text,
          rl.remaining_due::text,
          rl.payment_status,
          rl.next_due_date::text,
          s.shop_number,
          s.shop_name,
          t.tenant_name
        FROM shops s
        JOIN rent_ledgers rl ON rl.shop_id = s.shop_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id AND t.shop_id = s.shop_id
        WHERE s.owner_id = $1
          AND rl.payment_status <> 'PAID'
          AND rl.remaining_due > 0
        ORDER BY rl.rent_month DESC, s.shop_number ASC
      `,
      [ownerId],
    );

    return result.rows.map((row) => ({
      ...row,
      rent_amount: Number(row.rent_amount),
      previous_due: Number(row.previous_due),
      total_due: Number(row.total_due),
      amount_paid: Number(row.amount_paid),
      remaining_due: Number(row.remaining_due),
    }));
  });
}
