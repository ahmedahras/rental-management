import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const FIXED_OWNER_NAMES = ['U Fathima', 'Afsal', 'Hafeez', 'Riyaz', 'Shamin'] as const;

const ShopCreateSchema = z.object({
  shop_number: z.string().min(1),
  shop_name: z.string().min(1),
  owner_id: z.string().uuid(),
  monthly_rent: z.coerce.number().nonnegative(),
});

const ShopUpdateSchema = z.object({
  shop_number: z.string().min(1).optional(),
  shop_name: z.string().min(1).optional(),
  owner_id: z.string().uuid().optional(),
  monthly_rent: z.coerce.number().nonnegative().optional(),
  status: z.enum(['OCCUPIED', 'VACANT']).optional(),
});

const AssignTenantSchema = z.object({
  tenant_id: z.string().uuid(),
});

export async function shopRoutes(app: FastifyInstance): Promise<void> {
  app.get('/shops', { preHandler: [app.authenticate] }, async () => {
    const result = await app.db.query(
      `
        SELECT shop_id, shop_number, shop_name, owner_id, monthly_rent, status, current_tenant_id
        FROM shops
        ORDER BY shop_number
      `,
    );
    return result.rows;
  });

  app.post('/shops', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = ShopCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid shop payload' });
    }

    const row = parsed.data;
    const owner = await app.db.query<{ owner_id: string }>(
      `SELECT owner_id FROM owners WHERE owner_id = $1 AND owner_name = ANY($2::text[])`,
      [row.owner_id, FIXED_OWNER_NAMES],
    );
    if (!owner.rows[0]) {
      return reply.code(400).send({ message: 'Shop owner must be one of the predefined owners' });
    }

    const result = await app.db.query(
      `
        INSERT INTO shops(shop_number, shop_name, owner_id, monthly_rent, status, current_tenant_id)
        VALUES ($1, $2, $3, $4, 'VACANT', NULL)
        RETURNING shop_id, shop_number, shop_name, owner_id, monthly_rent, status, current_tenant_id
      `,
      [row.shop_number, row.shop_name, row.owner_id, row.monthly_rent],
    );

    return reply.code(201).send(result.rows[0]);
  });

  app.patch('/shops/:shopId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const shopId = (request.params as { shopId: string }).shopId;
    const parsed = ShopUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid shop payload' });
    }

    const data = parsed.data;
    if (data.status === 'OCCUPIED') {
      return reply.code(400).send({
        message: 'Cannot set OCCUPIED manually. Create/assign a tenant to occupy a shop.',
      });
    }

    if (data.owner_id) {
      const owner = await app.db.query<{ owner_id: string }>(
        `SELECT owner_id FROM owners WHERE owner_id = $1 AND owner_name = ANY($2::text[])`,
        [data.owner_id, FIXED_OWNER_NAMES],
      );
      if (!owner.rows[0]) {
        return reply.code(400).send({ message: 'Shop owner must be one of the predefined owners' });
      }
    }

    const result = await app.db.query(
      `
        UPDATE shops
        SET
          shop_number = COALESCE($2, shop_number),
          shop_name = COALESCE($3, shop_name),
          owner_id = COALESCE($4, owner_id),
          monthly_rent = COALESCE($5, monthly_rent),
          status = COALESCE($6, status),
          current_tenant_id = CASE
            WHEN $6::shop_status = 'VACANT' THEN NULL
            ELSE current_tenant_id
          END
        WHERE shop_id = $1
        RETURNING shop_id, shop_number, shop_name, owner_id, monthly_rent, status, current_tenant_id
      `,
      [
        shopId,
        data.shop_number ?? null,
        data.shop_name ?? null,
        data.owner_id ?? null,
        data.monthly_rent ?? null,
        data.status ?? null,
      ],
    );

    if (!result.rows[0]) {
      return reply.code(404).send({ message: 'Shop not found' });
    }

    await app.db.query(`SELECT refresh_monthly_summary_tables()`);

    return result.rows[0];
  });

  app.delete('/shops/:shopId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const shopId = (request.params as { shopId: string }).shopId;

    try {
      await app.db.query(`DELETE FROM shops WHERE shop_id = $1`, [shopId]);
      return reply.code(204).send();
    } catch {
      return reply.code(409).send({ message: 'Shop cannot be deleted due to linked records' });
    }
  });

  app.post('/shops/:shopId/assign-tenant', { preHandler: [app.authenticate] }, async (request, reply) => {
    const shopId = (request.params as { shopId: string }).shopId;
    const parsed = AssignTenantSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid assignment payload' });
    }

    const tenantId = parsed.data.tenant_id;

    const tenant = await app.db.query<{ shop_id: string; is_active: boolean }>(
      `SELECT shop_id, is_active FROM tenants WHERE tenant_id = $1`,
      [tenantId],
    );
    if (!tenant.rows[0]) {
      return reply.code(404).send({ message: 'Tenant not found' });
    }
    if (!tenant.rows[0].is_active) {
      return reply.code(400).send({ message: 'Tenant is not active' });
    }
    if (tenant.rows[0].shop_id !== shopId) {
      return reply.code(400).send({ message: 'Tenant does not belong to this shop' });
    }

    const result = await app.db.query(
      `
        UPDATE shops
        SET status = 'OCCUPIED', current_tenant_id = $2
        WHERE shop_id = $1
        RETURNING shop_id, shop_number, shop_name, owner_id, monthly_rent, status, current_tenant_id
      `,
      [shopId, tenantId],
    );

    if (!result.rows[0]) {
      return reply.code(404).send({ message: 'Shop not found' });
    }

    return result.rows[0];
  });

  app.post('/shops/:shopId/remove-tenant', { preHandler: [app.authenticate] }, async (request, reply) => {
    const shopId = (request.params as { shopId: string }).shopId;

    const result = await app.db.query(
      `
        UPDATE shops
        SET status = 'VACANT', current_tenant_id = NULL
        WHERE shop_id = $1
        RETURNING shop_id, shop_number, shop_name, owner_id, monthly_rent, status, current_tenant_id
      `,
      [shopId],
    );

    if (!result.rows[0]) {
      return reply.code(404).send({ message: 'Shop not found' });
    }

    return result.rows[0];
  });
}
