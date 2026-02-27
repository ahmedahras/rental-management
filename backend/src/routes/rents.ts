import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const GenerateRentCycleSchema = z.object({
  month: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/),
  next_due_date: z.string().date(),
});

export async function rentRoutes(app: FastifyInstance): Promise<void> {
  app.post('/rent-cycles/generate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = GenerateRentCycleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid month or due date' });
    }

    const row = parsed.data;
    const result = await app.db.query<{ inserted_count: number }>(
      `SELECT upsert_monthly_rent_cycle($1::char(7), $2::date) AS inserted_count`,
      [row.month, row.next_due_date],
    );
    await app.db.query(`SELECT refresh_monthly_summary_tables()`);

    return { inserted_count: Number(result.rows[0].inserted_count) };
  });

  app.get('/rents', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as { month?: string; status?: 'PAID' | 'PARTIAL' | 'PENDING' };

    const result = await app.db.query(
      `
        SELECT
          rl.rent_id,
          rl.shop_id,
          rl.tenant_id,
          rl.rent_month AS month,
          rl.rent_amount,
          rl.previous_due,
          rl.total_due,
          rl.amount_paid,
          rl.remaining_due,
          rl.payment_status,
          rl.next_due_date,
          s.shop_number,
          t.tenant_name
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        WHERE ($1::text IS NULL OR rl.rent_month = $1)
          AND ($2::text IS NULL OR rl.payment_status = $2::rent_payment_status)
        ORDER BY rl.rent_month DESC, s.shop_number ASC
      `,
      [query.month ?? null, query.status ?? null],
    );

    return result.rows;
  });
}
