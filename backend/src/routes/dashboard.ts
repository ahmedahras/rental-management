import { FastifyInstance } from 'fastify';

interface DashboardRow {
  total_shops: string;
  occupied_shops: string;
  vacant_shops: string;
  expected_rent_current_month: string;
  collected_current_month: string;
  pending_dues_current_month: string;
}

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard/summary', { preHandler: [app.authenticate] }, async () => {
    const month = new Date().toISOString().slice(0, 7);
    const res = await app.db.query<DashboardRow>(
      `
        SELECT
          (SELECT COUNT(*)::text FROM shops) AS total_shops,
          (SELECT COUNT(*)::text FROM shops WHERE status = 'OCCUPIED') AS occupied_shops,
          (SELECT COUNT(*)::text FROM shops WHERE status = 'VACANT') AS vacant_shops,
          (SELECT COALESCE(SUM(total_due), 0)::text FROM rent_ledgers WHERE rent_month = $1) AS expected_rent_current_month,
          (SELECT COALESCE(SUM(amount_paid), 0)::text FROM rent_ledgers WHERE rent_month = $1) AS collected_current_month,
          (SELECT COALESCE(SUM(remaining_due), 0)::text FROM rent_ledgers WHERE rent_month = $1) AS pending_dues_current_month
      `,
      [month],
    );

    const row = res.rows[0];
    return {
      total_shops: Number(row.total_shops),
      occupied_shops: Number(row.occupied_shops),
      vacant_shops: Number(row.vacant_shops),
      expected_rent_current_month: Number(row.expected_rent_current_month),
      collected_current_month: Number(row.collected_current_month),
      pending_dues_current_month: Number(row.pending_dues_current_month),
    };
  });
}
