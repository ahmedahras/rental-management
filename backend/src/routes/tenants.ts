import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const TenantCreateSchema = z.object({
  tenant_name: z.string().min(1),
  whatsapp_number: z.string().min(7),
  shop_id: z.string().uuid(),
  agreement_start_date: z.string().date().optional(),
  due_start_date: z.string().date().optional(),
  opening_balance: z.coerce.number().min(0).optional().default(0),
  // Backward compatibility for existing clients.
  rent_start_date: z.string().date().optional(),
  agreement_end_date: z.string().date().optional(),
  notes: z.string().optional(),
});

const TenantUpdateSchema = z.object({
  tenant_name: z.string().min(1).optional(),
  whatsapp_number: z.string().min(7).optional(),
  agreement_end_date: z.string().date().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

interface ShopRow {
  shop_id: string;
  monthly_rent: string;
}

interface TenantRow {
  tenant_id: string;
  tenant_name: string;
  whatsapp_number: string;
  shop_id: string;
  rent_start_date: string;
  agreement_end_date: string | null;
  notes: string | null;
  is_active: boolean;
}

interface ExistingRentRow {
  rent_month: string;
  remaining_due: string;
}

interface InsertedRentRow {
  remaining_due: string;
}

const MONEY_SCALE = 100;

function toCents(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Math.round(parsed * MONEY_SCALE);
}

function fromCents(cents: number): string {
  return (cents / MONEY_SCALE).toFixed(2);
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function monthStart(dateString: string): Date {
  const [year, month] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function nextDueDateForMonth(month: string): string {
  const [year, monthNo] = month.split('-').map(Number);
  const dueDate = new Date(Date.UTC(year, monthNo, 5));
  return dueDate.toISOString().slice(0, 10);
}

function monthsBetween(startMonth: string, endMonth: string): string[] {
  const start = monthStart(startMonth);
  const end = monthStart(endMonth);
  if (start > end) {
    return [];
  }

  const months: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tenants', { preHandler: [app.authenticate] }, async () => {
    const result = await app.db.query(
      `
        SELECT tenant_id, tenant_name, whatsapp_number, shop_id, rent_start_date,
               agreement_end_date, notes, is_active
        FROM tenants
        ORDER BY created_at DESC
      `,
    );
    return result.rows;
  });

  app.post('/tenants', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = TenantCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid tenant payload' });
    }

    const data = parsed.data;
    const agreementStartDate = data.agreement_start_date ?? data.rent_start_date;
    if (!agreementStartDate) {
      return reply.code(400).send({ message: 'agreement_start_date is required' });
    }

    const dueStartDate = data.due_start_date ?? agreementStartDate;
    const dueStartMonth = dueStartDate.slice(0, 7);
    const currentMonth = monthKey(new Date());
    const monthsToGenerate = monthsBetween(dueStartMonth, currentMonth);
    const openingBalanceCents = toCents(data.opening_balance ?? 0);

    const result = await app.db.withTransaction(async (tx) => {
      const shopResult = await tx.query<ShopRow>(
        `SELECT shop_id, monthly_rent::text FROM shops WHERE shop_id = $1 FOR UPDATE`,
        [data.shop_id],
      );
      const shop = shopResult.rows[0];
      if (!shop) {
        throw app.httpErrors.notFound('Shop not found');
      }

      const insert = await tx.query<TenantRow>(
        `
          INSERT INTO tenants(
            tenant_name, whatsapp_number, shop_id, rent_start_date,
            agreement_end_date, notes, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
          RETURNING tenant_id, tenant_name, whatsapp_number, shop_id,
                    rent_start_date, agreement_end_date, notes, is_active
        `,
        [
          data.tenant_name,
          data.whatsapp_number,
          data.shop_id,
          agreementStartDate,
          data.agreement_end_date ?? null,
          data.notes ?? null,
        ],
      );
      const tenant = insert.rows[0];

      await tx.query(
        `
          UPDATE shops
          SET status = 'OCCUPIED', current_tenant_id = $2
          WHERE shop_id = $1
        `,
        [data.shop_id, tenant.tenant_id],
      );

      const existingRentResult = await tx.query<ExistingRentRow>(
        `
          SELECT rent_month, remaining_due::text
          FROM rent_ledgers
          WHERE shop_id = $1
            AND rent_month = ANY($2::text[])
          ORDER BY rent_month ASC
        `,
        [data.shop_id, monthsToGenerate],
      );

      const existingByMonth = new Map<string, number>();
      for (const row of existingRentResult.rows) {
        existingByMonth.set(row.rent_month, toCents(row.remaining_due));
      }

      const monthlyRentCents = toCents(shop.monthly_rent);

      for (var index = 0; index < monthsToGenerate.length; index += 1) {
        const month = monthsToGenerate[index];
        const monthExtraCents = index == 0 ? openingBalanceCents : 0;
        const existingRemainingDue = existingByMonth.get(month);
        if (existingRemainingDue !== undefined) {
          continue;
        }

        const totalDueCents = monthlyRentCents + monthExtraCents;
        const insertedRent = await tx.query<InsertedRentRow>(
          `
            INSERT INTO rent_ledgers(
              shop_id, tenant_id, rent_month, rent_amount, previous_due,
              total_due, amount_paid, remaining_due, payment_status, next_due_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'PENDING', $8)
            ON CONFLICT (shop_id, rent_month) DO NOTHING
            RETURNING remaining_due::text
          `,
          [
            data.shop_id,
            tenant.tenant_id,
            month,
            fromCents(monthlyRentCents),
            fromCents(monthExtraCents),
            fromCents(totalDueCents),
            fromCents(totalDueCents),
            nextDueDateForMonth(month),
          ],
        );

        if (insertedRent.rows[0]) {
          continue;
        }

        // Conflict row already exists; no carry-forward is applied across months.
      }

      await tx.query(`SELECT refresh_monthly_summary_tables()`);

      return tenant;
    });

    return reply.code(201).send(result);
  });

  app.patch('/tenants/:tenantId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    const parsed = TenantUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid tenant payload' });
    }

    const data = parsed.data;
    const result = await app.db.query(
      `
        UPDATE tenants
        SET
          tenant_name = COALESCE($2, tenant_name),
          whatsapp_number = COALESCE($3, whatsapp_number),
          agreement_end_date = CASE WHEN $4::date IS NULL THEN agreement_end_date ELSE $4 END,
          notes = CASE WHEN $5::text IS NULL THEN notes ELSE $5 END,
          is_active = COALESCE($6, is_active)
        WHERE tenant_id = $1
        RETURNING tenant_id, tenant_name, whatsapp_number, shop_id,
                  rent_start_date, agreement_end_date, notes, is_active
      `,
      [
        tenantId,
        data.tenant_name ?? null,
        data.whatsapp_number ?? null,
        data.agreement_end_date ?? null,
        data.notes ?? null,
        data.is_active ?? null,
      ],
    );

    if (!result.rows[0]) {
      return reply.code(404).send({ message: 'Tenant not found' });
    }

    return result.rows[0];
  });

  app.delete('/tenants/:tenantId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;

    try {
      await app.db.query(`DELETE FROM tenants WHERE tenant_id = $1`, [tenantId]);
      return reply.code(204).send();
    } catch {
      return reply.code(409).send({ message: 'Tenant cannot be deleted due to linked records' });
    }
  });

  app.get('/tenants/:tenantId/payments', { preHandler: [app.authenticate] }, async (request) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    const result = await app.db.query(
      `
        SELECT
          pe.payment_id,
          pe.paid_on,
          pe.amount,
          pe.payment_mode,
          pe.transaction_ref,
          rl.rent_month,
          rl.total_due,
          rl.remaining_due
        FROM payment_entries pe
        JOIN rent_ledgers rl ON rl.rent_id = pe.rent_id
        WHERE pe.tenant_id = $1
        ORDER BY pe.paid_on DESC, pe.created_at DESC
      `,
      [tenantId],
    );

    return result.rows;
  });
}
