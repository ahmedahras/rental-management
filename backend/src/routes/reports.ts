import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { buildReportFile } from '../services/report-export.service';

type ReportType = 'owner_wise' | 'shop_wise' | 'tenant_wise' | 'summary';
const FIXED_OWNER_NAMES = ['U Fathima', 'Afsal', 'Hafeez', 'Riyaz', 'Shamin'] as const;

const ExportQuerySchema = z.object({
  report_type: z.enum(['owner_wise', 'shop_wise', 'tenant_wise', 'summary']),
  format: z.enum(['pdf', 'xlsx']),
  from_month: z.string().optional(),
  to_month: z.string().optional(),
});

const MonthlyDashboardQuerySchema = z.object({
  month: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/).optional(),
  owner_id: z.string().uuid().optional(),
});

const MonthlyExcelQuerySchema = z.object({
  month: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/).optional(),
  owner_id: z.string().uuid().optional(),
});

const FullExcelQuerySchema = z.object({
  owner_id: z.string().uuid().optional(),
});

function fileTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

function styleWorksheet(sheet: ExcelJS.Worksheet, moneyCols: number[] = []): void {
  if (sheet.rowCount > 0 && sheet.columnCount > 0) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount },
    };
  }

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  header.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4F8' },
    };
  });

  for (let i = 1; i <= sheet.columnCount; i += 1) {
    sheet.getColumn(i).width = 20;
  }

  for (const col of moneyCols) {
    sheet.getColumn(col).numFmt = '#,##0.00';
  }
}

async function fetchReportRows(
  app: FastifyInstance,
  reportType: ReportType,
  filters: { fromMonth?: string; toMonth?: string },
): Promise<Record<string, string | number | null>[]> {
  if (reportType === 'owner_wise') {
    const result = await app.db.query(
      `
        SELECT
          o.owner_id,
          o.owner_name,
          COUNT(DISTINCT s.shop_id) AS total_shops,
          COALESCE(SUM(rl.total_due), 0)::numeric(12,2) AS total_due,
          COALESCE(SUM(rl.amount_paid), 0)::numeric(12,2) AS total_collected,
          COALESCE(SUM(rl.remaining_due), 0)::numeric(12,2) AS total_pending
        FROM owners o
        LEFT JOIN shops s ON s.owner_id = o.owner_id
        LEFT JOIN rent_ledgers rl ON rl.shop_id = s.shop_id
          AND ($1::text IS NULL OR rl.rent_month >= $1)
          AND ($2::text IS NULL OR rl.rent_month <= $2)
        GROUP BY o.owner_id, o.owner_name
        ORDER BY o.owner_name ASC
      `,
      [filters.fromMonth ?? null, filters.toMonth ?? null],
    );
    return result.rows as Record<string, string | number | null>[];
  }

  if (reportType === 'shop_wise') {
    const result = await app.db.query(
      `
        SELECT
          s.shop_number,
          o.owner_name,
          t.tenant_name,
          rl.rent_month,
          rl.total_due,
          rl.amount_paid,
          rl.remaining_due,
          rl.payment_status
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN owners o ON o.owner_id = s.owner_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        WHERE ($1::text IS NULL OR rl.rent_month >= $1)
          AND ($2::text IS NULL OR rl.rent_month <= $2)
        ORDER BY s.shop_number, rl.rent_month DESC
      `,
      [filters.fromMonth ?? null, filters.toMonth ?? null],
    );
    return result.rows as Record<string, string | number | null>[];
  }

  if (reportType === 'tenant_wise') {
    const result = await app.db.query(
      `
        SELECT
          t.tenant_name,
          s.shop_number,
          pe.paid_on,
          pe.amount,
          pe.payment_mode,
          pe.transaction_ref,
          rl.rent_month
        FROM payment_entries pe
        JOIN tenants t ON t.tenant_id = pe.tenant_id
        JOIN shops s ON s.shop_id = pe.shop_id
        JOIN rent_ledgers rl ON rl.rent_id = pe.rent_id
        WHERE ($1::text IS NULL OR rl.rent_month >= $1)
          AND ($2::text IS NULL OR rl.rent_month <= $2)
        ORDER BY pe.paid_on DESC
      `,
      [filters.fromMonth ?? null, filters.toMonth ?? null],
    );
    return result.rows as Record<string, string | number | null>[];
  }

  const monthly = await app.db.query(
    `
      SELECT
        rl.rent_month,
        COUNT(*) AS ledgers,
        COALESCE(SUM(rl.total_due), 0)::numeric(12,2) AS total_due,
        COALESCE(SUM(rl.amount_paid), 0)::numeric(12,2) AS total_collected,
        COALESCE(SUM(rl.remaining_due), 0)::numeric(12,2) AS total_pending
      FROM rent_ledgers rl
      WHERE ($1::text IS NULL OR rl.rent_month >= $1)
        AND ($2::text IS NULL OR rl.rent_month <= $2)
      GROUP BY rl.rent_month
      ORDER BY rl.rent_month DESC
    `,
    [filters.fromMonth ?? null, filters.toMonth ?? null],
  );
  return monthly.rows as Record<string, string | number | null>[];
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/reports/owner-wise', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as { from_month?: string; to_month?: string };
    return fetchReportRows(app, 'owner_wise', { fromMonth: query.from_month, toMonth: query.to_month });
  });

  app.get('/reports/shop-wise', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as { from_month?: string; to_month?: string };
    return fetchReportRows(app, 'shop_wise', { fromMonth: query.from_month, toMonth: query.to_month });
  });

  app.get('/reports/tenant-wise', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as { from_month?: string; to_month?: string };
    return fetchReportRows(app, 'tenant_wise', { fromMonth: query.from_month, toMonth: query.to_month });
  });

  app.get('/reports/summary', { preHandler: [app.authenticate] }, async (request) => {
    const query = request.query as { from_month?: string; to_month?: string };
    return fetchReportRows(app, 'summary', { fromMonth: query.from_month, toMonth: query.to_month });
  });

  app.get('/reports/monthly-dashboard', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = MonthlyDashboardQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid report filter query' });
    }

    const filter = parsed.data;

    if (filter.owner_id) {
      const owner = await app.db.query<{ owner_id: string }>(
        `SELECT owner_id FROM owners WHERE owner_id = $1 LIMIT 1`,
        [filter.owner_id],
      );
      if (!owner.rows[0]) {
        return reply.code(404).send({ message: 'Owner not found' });
      }
    }

    const availableMonthsResult = await app.db.query<{ month: string }>(
      `
        SELECT DISTINCT mos.summary_month AS month
        FROM monthly_owner_summary mos
        JOIN owners o ON o.owner_id = mos.owner_id
        WHERE o.owner_name = ANY($2::text[])
          AND ($1::uuid IS NULL OR mos.owner_id = $1)
        ORDER BY mos.summary_month ASC
      `,
      [filter.owner_id ?? null, FIXED_OWNER_NAMES],
    );
    const availableMonths = availableMonthsResult.rows.map((row) => row.month);
    const selectedMonth = filter.month ?? (availableMonths.length > 0 ? availableMonths[availableMonths.length - 1] : null);

    if (!selectedMonth) {
      return {
        selected_month: null,
        available_months: [],
        summary: {
          expected: 0,
          collected: 0,
          remaining: 0,
          collection_percentage: 0,
        },
        monthly_comparison: [],
        shop_breakdown: [],
        tenant_breakdown: [],
      };
    }

    const summaryResult = await app.db.query<{ expected: string; collected: string; remaining: string }>(
      `
        SELECT
          COALESCE(SUM(mos.expected_rent), 0)::text AS expected,
          COALESCE(SUM(mos.collected_rent), 0)::text AS collected,
          COALESCE(SUM(mos.remaining_due), 0)::text AS remaining
        FROM monthly_owner_summary mos
        JOIN owners o ON o.owner_id = mos.owner_id
        WHERE mos.summary_month = $1
          AND o.owner_name = ANY($3::text[])
          AND ($2::uuid IS NULL OR mos.owner_id = $2)
      `,
      [selectedMonth, filter.owner_id ?? null, FIXED_OWNER_NAMES],
    );
    const expected = Number(summaryResult.rows[0]?.expected ?? 0);
    const collected = Number(summaryResult.rows[0]?.collected ?? 0);
    const remaining = Number(summaryResult.rows[0]?.remaining ?? expected - collected);
    const collectionPercentage = expected > 0 ? (collected / expected) * 100 : 0;

    const comparisonResult = await app.db.query<{
      month: string;
      expected: string;
      collected: string;
      remaining: string;
    }>(
      `
        SELECT
          mos.summary_month AS month,
          COALESCE(SUM(mos.expected_rent), 0)::text AS expected,
          COALESCE(SUM(mos.collected_rent), 0)::text AS collected,
          COALESCE(SUM(mos.remaining_due), 0)::text AS remaining
        FROM monthly_owner_summary mos
        JOIN owners o ON o.owner_id = mos.owner_id
        WHERE o.owner_name = ANY($2::text[])
          AND ($1::uuid IS NULL OR mos.owner_id = $1)
        GROUP BY mos.summary_month
        ORDER BY mos.summary_month ASC
      `,
      [filter.owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const agingResult = await app.db.query<{
      bucket: '0-30' | '31-60' | '61-90' | '90+';
      total_due: string;
    }>(
      `
        SELECT
          CASE
            WHEN overdue_days <= 30 THEN '0-30'
            WHEN overdue_days <= 60 THEN '31-60'
            WHEN overdue_days <= 90 THEN '61-90'
            ELSE '90+'
          END AS bucket,
          COALESCE(SUM(remaining_due), 0)::text AS total_due
        FROM (
          SELECT
            rl.remaining_due,
            GREATEST((CURRENT_DATE - rl.next_due_date), 0) AS overdue_days
          FROM rent_ledgers rl
          JOIN shops s ON s.shop_id = rl.shop_id
          JOIN owners o ON o.owner_id = s.owner_id
          WHERE rl.remaining_due > 0
            AND rl.rent_month <= $1
            AND o.owner_name = ANY($3::text[])
            AND ($2::uuid IS NULL OR s.owner_id = $2)
        ) q
        GROUP BY bucket
      `,
      [selectedMonth, filter.owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const donutResult = await app.db.query<{
      owner_id: string;
      owner_name: string;
      collected: string;
    }>(
      `
        WITH owner_month_collected AS (
          SELECT
            s.owner_id,
            COALESCE(SUM(rl.amount_paid), 0)::numeric(12,2) AS collected
          FROM rent_ledgers rl
          JOIN shops s ON s.shop_id = rl.shop_id
          WHERE rl.rent_month = $1
            AND ($2::uuid IS NULL OR s.owner_id = $2)
          GROUP BY s.owner_id
        )
        SELECT
          o.owner_id::text,
          o.owner_name,
          COALESCE(omc.collected, 0)::text AS collected
        FROM owners o
        LEFT JOIN owner_month_collected omc ON omc.owner_id = o.owner_id
        WHERE o.owner_name = ANY($3::text[])
          AND ($2::uuid IS NULL OR o.owner_id = $2)
          AND COALESCE(omc.collected, 0) > 0
        ORDER BY o.owner_name ASC
      `,
      [selectedMonth, filter.owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const shopBreakdownResult = await app.db.query<{
      shop_number: string;
      total_due: string;
    }>(
      `
        SELECT
          s.shop_number,
          COALESCE(SUM(rl.remaining_due), 0)::text AS total_due
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN owners ox ON ox.owner_id = s.owner_id
        WHERE rl.rent_month = $1
          AND ox.owner_name = ANY($3::text[])
          AND rl.remaining_due > 0
          AND ($2::uuid IS NULL OR s.owner_id = $2)
        GROUP BY s.shop_number
        HAVING COALESCE(SUM(rl.remaining_due), 0) > 0
        ORDER BY s.shop_number ASC
      `,
      [selectedMonth, filter.owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const tenantBreakdownResult = await app.db.query<{
      tenant_name: string;
      shop_number: string;
      total_due: string;
    }>(
      `
        SELECT
          t.tenant_name,
          s.shop_number,
          COALESCE(SUM(rl.remaining_due), 0)::text AS total_due
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id AND t.shop_id = s.shop_id
        JOIN owners o ON o.owner_id = s.owner_id
        WHERE rl.rent_month = $1
          AND o.owner_name = ANY($3::text[])
          AND rl.remaining_due > 0
          AND ($2::uuid IS NULL OR s.owner_id = $2)
        GROUP BY t.tenant_name, s.shop_number
        HAVING COALESCE(SUM(rl.remaining_due), 0) > 0
        ORDER BY t.tenant_name ASC, s.shop_number ASC
      `,
      [selectedMonth, filter.owner_id ?? null, FIXED_OWNER_NAMES],
    );

    return {
      selected_month: selectedMonth,
      available_months: availableMonths,
      summary: {
        expected,
        collected,
        remaining,
        collection_percentage: Number(collectionPercentage.toFixed(2)),
      },
      monthly_comparison: comparisonResult.rows.map((row) => {
        const monthExpected = Number(row.expected);
        const monthCollected = Number(row.collected);
        const monthRemaining = Number(row.remaining);
        return {
          month: row.month,
          expected: monthExpected,
          collected: monthCollected,
          remaining: monthRemaining,
        };
      }),
      shop_breakdown: shopBreakdownResult.rows.map((row) => ({
        shop_number: row.shop_number,
        total_due: Number(row.total_due),
      })),
      tenant_breakdown: tenantBreakdownResult.rows.map((row) => ({
        tenant_name: row.tenant_name,
        shop_number: row.shop_number,
        total_due: Number(row.total_due),
      })),
      charts: {
        line_series: comparisonResult.rows.map((row) => ({
          month: row.month,
          expected: Number(row.expected),
          collected: Number(row.collected),
          remaining: Number(row.remaining),
        })),
        bar_series: comparisonResult.rows.map((row) => ({
          month: row.month,
          collected: Number(row.collected),
          due: Number(row.remaining),
        })),
        donut_series: donutResult.rows.map((row) => ({
          owner_name: row.owner_name,
          collected: Number(row.collected),
        })),
        aging_series: [
          '0-30',
          '31-60',
          '61-90',
          '90+',
        ].map((bucket) => {
          const row = agingResult.rows.find((r) => r.bucket === bucket);
          return {
            bucket,
            total_due: Number(row?.total_due ?? 0),
          };
        }),
      },
    };
  });

  app.get('/reports/export/monthly-excel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = MonthlyExcelQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid export query' });
    }

    const { month, owner_id } = parsed.data;
    if (owner_id) {
      const owner = await app.db.query<{ owner_id: string }>(
        `SELECT owner_id FROM owners WHERE owner_id = $1 AND owner_name = ANY($2::text[]) LIMIT 1`,
        [owner_id, FIXED_OWNER_NAMES],
      );
      if (!owner.rows[0]) {
        return reply.code(404).send({ message: 'Owner not found' });
      }
    }

    const monthResult = await app.db.query<{ month: string }>(
      `
        SELECT DISTINCT mos.summary_month AS month
        FROM monthly_owner_summary mos
        JOIN owners o ON o.owner_id = mos.owner_id
        WHERE o.owner_name = ANY($2::text[])
          AND ($1::uuid IS NULL OR mos.owner_id = $1)
        ORDER BY mos.summary_month ASC
      `,
      [owner_id ?? null, FIXED_OWNER_NAMES],
    );
    const selectedMonth = month ?? monthResult.rows[monthResult.rows.length - 1]?.month;
    if (!selectedMonth) {
      return reply.code(400).send({ message: 'No report data available' });
    }

    const summaryRows = await app.db.query<{
      owner_name: string;
      expected_amount: string;
      collected_amount: string;
      remaining_amount: string;
    }>(
      `
        SELECT
          o.owner_name,
          COALESCE(mos.expected_rent, 0)::text AS expected_amount,
          COALESCE(mos.collected_rent, 0)::text AS collected_amount,
          COALESCE(mos.remaining_due, 0)::text AS remaining_amount
        FROM owners o
        LEFT JOIN monthly_owner_summary mos
          ON mos.owner_id = o.owner_id
         AND mos.summary_month = $1
        WHERE o.owner_name = ANY($3::text[])
          AND ($2::uuid IS NULL OR o.owner_id = $2)
        ORDER BY o.owner_name ASC
      `,
      [selectedMonth, owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const shopRows = await app.db.query<{
      owner_name: string;
      shop_number: string;
      tenant_name: string;
      expected_amount: string;
      collected_amount: string;
      due_amount: string;
      status: string;
    }>(
      `
        SELECT
          o.owner_name,
          s.shop_number,
          t.tenant_name,
          COALESCE(SUM(rl.rent_amount), 0)::text AS expected_amount,
          COALESCE(SUM(rl.amount_paid), 0)::text AS collected_amount,
          COALESCE(SUM(rl.remaining_due), 0)::text AS due_amount,
          MIN(rl.payment_status)::text AS status
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN owners o ON o.owner_id = s.owner_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        WHERE rl.rent_month = $1
          AND o.owner_name = ANY($3::text[])
          AND ($2::uuid IS NULL OR o.owner_id = $2)
        GROUP BY o.owner_name, s.shop_number, t.tenant_name
        ORDER BY o.owner_name ASC, s.shop_number ASC, t.tenant_name ASC
      `,
      [selectedMonth, owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const tenantRows = await app.db.query<{
      tenant_id: string;
      shop_id: string;
      owner_name: string;
      tenant_name: string;
      shop_number: string;
      expected_amount: string;
      collected_amount: string;
      remaining_amount: string;
    }>(
      `
        SELECT
          t.tenant_id::text AS tenant_id,
          s.shop_id::text AS shop_id,
          o.owner_name,
          t.tenant_name,
          s.shop_number,
          COALESCE(SUM(rl.rent_amount), 0)::text AS expected_amount,
          COALESCE(SUM(rl.amount_paid), 0)::text AS collected_amount,
          COALESCE(SUM(rl.remaining_due), 0)::text AS remaining_amount
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN owners o ON o.owner_id = s.owner_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        WHERE rl.rent_month = $1
          AND o.owner_name = ANY($3::text[])
          AND ($2::uuid IS NULL OR o.owner_id = $2)
        GROUP BY t.tenant_id, s.shop_id, o.owner_name, t.tenant_name, s.shop_number
        ORDER BY o.owner_name ASC, t.tenant_name ASC, s.shop_number ASC
      `,
      [selectedMonth, owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const agingRows = await app.db.query<{
      owner_name: string;
      tenant_name: string;
      shop_number: string;
      due_0_30: string;
      due_31_60: string;
      due_61_90: string;
      due_90_plus: string;
    }>(
      `
        SELECT
          o.owner_name,
          t.tenant_name,
          s.shop_number,
          COALESCE(SUM(CASE WHEN overdue_days <= 30 THEN rl.remaining_due ELSE 0 END), 0)::text AS due_0_30,
          COALESCE(SUM(CASE WHEN overdue_days BETWEEN 31 AND 60 THEN rl.remaining_due ELSE 0 END), 0)::text AS due_31_60,
          COALESCE(SUM(CASE WHEN overdue_days BETWEEN 61 AND 90 THEN rl.remaining_due ELSE 0 END), 0)::text AS due_61_90,
          COALESCE(SUM(CASE WHEN overdue_days > 90 THEN rl.remaining_due ELSE 0 END), 0)::text AS due_90_plus
        FROM (
          SELECT
            rent_id,
            shop_id,
            tenant_id,
            remaining_due,
            GREATEST((CURRENT_DATE - next_due_date), 0) AS overdue_days
          FROM rent_ledgers
          WHERE remaining_due > 0
            AND rent_month <= $1
        ) rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN owners o ON o.owner_id = s.owner_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        WHERE o.owner_name = ANY($3::text[])
          AND ($2::uuid IS NULL OR o.owner_id = $2)
        GROUP BY o.owner_name, t.tenant_name, s.shop_number
        HAVING
          COALESCE(SUM(CASE WHEN overdue_days <= 30 THEN rl.remaining_due ELSE 0 END), 0) > 0
          OR COALESCE(SUM(CASE WHEN overdue_days BETWEEN 31 AND 60 THEN rl.remaining_due ELSE 0 END), 0) > 0
          OR COALESCE(SUM(CASE WHEN overdue_days BETWEEN 61 AND 90 THEN rl.remaining_due ELSE 0 END), 0) > 0
          OR COALESCE(SUM(CASE WHEN overdue_days > 90 THEN rl.remaining_due ELSE 0 END), 0) > 0
        ORDER BY o.owner_name ASC, t.tenant_name ASC, s.shop_number ASC
      `,
      [selectedMonth, owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Monthly Summary');
    summarySheet.addRow(['Month', 'Owner', 'Expected Amount', 'Collected Amount', 'Remaining Amount', 'Collection Percentage']);
    for (const row of summaryRows.rows) {
      const expectedAmount = Number(row.expected_amount);
      const collectedAmount = Number(row.collected_amount);
      const remainingAmount = Number(row.remaining_amount);
      const percentage = expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0;
      summarySheet.addRow([selectedMonth, row.owner_name, expectedAmount, collectedAmount, remainingAmount, percentage]);
    }
    styleWorksheet(summarySheet, [3, 4, 5, 6]);
    summarySheet.getColumn(6).numFmt = '0.00%';
    for (let i = 2; i <= summarySheet.rowCount; i += 1) {
      summarySheet.getCell(i, 6).value = (summarySheet.getCell(i, 6).value as number) / 100;
    }

    const shopSheet = workbook.addWorksheet('Shop-wise Breakdown');
    shopSheet.addRow(['Month', 'Owner', 'Shop Number', 'Tenant Name', 'Expected Amount', 'Collected Amount', 'Due Amount', 'Status']);
    for (const row of shopRows.rows) {
      shopSheet.addRow([
        selectedMonth,
        row.owner_name,
        row.shop_number,
        row.tenant_name,
        Number(row.expected_amount),
        Number(row.collected_amount),
        Number(row.due_amount),
        row.status,
      ]);
    }
    styleWorksheet(shopSheet, [5, 6, 7]);

    const tenantSheet = workbook.addWorksheet('Tenant-wise Breakdown');
    tenantSheet.addRow(['Month', 'Owner', 'Tenant Name', 'Shop Number', 'Expected Amount', 'Collected Amount', 'Remaining Amount']);
    for (const row of tenantRows.rows) {
      tenantSheet.addRow([
        selectedMonth,
        row.owner_name,
        row.tenant_name,
        row.shop_number,
        Number(row.expected_amount),
        Number(row.collected_amount),
        Number(row.remaining_amount),
      ]);
    }
    styleWorksheet(tenantSheet, [5, 6, 7]);

    const detailedLedgerRows = await app.db.query<{
      owner_name: string;
      tenant_name: string;
      shop_number: string;
      expected_amount: string;
      collected_amount: string;
      due_amount: string;
      status: string;
    }>(
      `
        SELECT
          o.owner_name,
          t.tenant_name,
          s.shop_number,
          rl.rent_amount::text AS expected_amount,
          rl.amount_paid::text AS collected_amount,
          rl.remaining_due::text AS due_amount,
          rl.payment_status::text AS status
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN owners o ON o.owner_id = s.owner_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        WHERE rl.rent_month = $1
          AND o.owner_name = ANY($3::text[])
          AND ($2::uuid IS NULL OR o.owner_id = $2)
        ORDER BY o.owner_name ASC, s.shop_number ASC, t.tenant_name ASC
      `,
      [selectedMonth, owner_id ?? null, FIXED_OWNER_NAMES],
    );

    const detailSheet = workbook.addWorksheet('Detailed Ledger');
    detailSheet.addRow(['Month', 'Owner', 'Tenant Name', 'Shop Number', 'Expected Amount', 'Collected Amount', 'Due Amount', 'Status']);
    for (const row of detailedLedgerRows.rows) {
      detailSheet.addRow([
        selectedMonth,
        row.owner_name,
        row.tenant_name,
        row.shop_number,
        Number(row.expected_amount),
        Number(row.collected_amount),
        Number(row.due_amount),
        row.status,
      ]);
    }
    styleWorksheet(detailSheet, [5, 6, 7]);

    const agingSheet = workbook.addWorksheet('Aging Report');
    agingSheet.addRow(['Owner', 'Tenant Name', 'Shop Number', 'Due 0-30 Days', 'Due 31-60 Days', 'Due 61-90 Days', 'Due 90+ Days']);
    for (const row of agingRows.rows) {
      agingSheet.addRow([
        row.owner_name,
        row.tenant_name,
        row.shop_number,
        Number(row.due_0_30),
        Number(row.due_31_60),
        Number(row.due_61_90),
        Number(row.due_90_plus),
      ]);
    }
    styleWorksheet(agingSheet, [4, 5, 6, 7]);

    const data = await workbook.xlsx.writeBuffer();
    const fileName = `monthly-report-${selectedMonth}-${fileTimestamp()}.xlsx`;
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(Buffer.from(data));
  });

  app.get('/reports/export/full-excel', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = FullExcelQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid export query' });
    }
    const ownerId = parsed.data.owner_id ?? null;

    if (ownerId) {
      const owner = await app.db.query<{ owner_id: string }>(
        `SELECT owner_id FROM owners WHERE owner_id = $1 AND owner_name = ANY($2::text[]) LIMIT 1`,
        [ownerId, FIXED_OWNER_NAMES],
      );
      if (!owner.rows[0]) {
        return reply.code(404).send({ message: 'Owner not found' });
      }
    }

    const monthlySummary = await app.db.query<{
      month: string;
      expected: string;
      collected: string;
      remaining: string;
    }>(
      `
        SELECT
          mos.summary_month AS month,
          COALESCE(SUM(mos.expected_rent), 0)::text AS expected,
          COALESCE(SUM(mos.collected_rent), 0)::text AS collected,
          COALESCE(SUM(mos.remaining_due), 0)::text AS remaining
        FROM monthly_owner_summary mos
        JOIN owners o ON o.owner_id = mos.owner_id
        WHERE o.owner_name = ANY($2::text[])
          AND ($1::uuid IS NULL OR o.owner_id = $1)
        GROUP BY mos.summary_month
        ORDER BY mos.summary_month ASC
      `,
      [ownerId, FIXED_OWNER_NAMES],
    );

    const ownerMonthly = await app.db.query<{
      month: string;
      owner_name: string;
      expected: string;
      collected: string;
      remaining: string;
      tenant_names: string;
      shop_numbers: string;
    }>(
      `
        SELECT
          mos.summary_month AS month,
          o.owner_name,
          mos.expected_rent::text AS expected,
          mos.collected_rent::text AS collected,
          mos.remaining_due::text AS remaining,
          COALESCE((
            SELECT string_agg(DISTINCT t.tenant_name, ', ' ORDER BY t.tenant_name)
            FROM rent_ledgers rl
            JOIN shops s ON s.shop_id = rl.shop_id
            JOIN tenants t ON t.tenant_id = rl.tenant_id
            WHERE rl.rent_month = mos.summary_month
              AND s.owner_id = mos.owner_id
          ), '') AS tenant_names,
          COALESCE((
            SELECT string_agg(DISTINCT s.shop_number, ', ' ORDER BY s.shop_number)
            FROM rent_ledgers rl
            JOIN shops s ON s.shop_id = rl.shop_id
            WHERE rl.rent_month = mos.summary_month
              AND s.owner_id = mos.owner_id
          ), '') AS shop_numbers
        FROM monthly_owner_summary mos
        JOIN owners o ON o.owner_id = mos.owner_id
        WHERE o.owner_name = ANY($2::text[])
          AND ($1::uuid IS NULL OR o.owner_id = $1)
        ORDER BY mos.summary_month ASC, o.owner_name ASC
      `,
      [ownerId, FIXED_OWNER_NAMES],
    );

    const shopLedger = await app.db.query<{
      month: string;
      owner_name: string;
      shop_number: string;
      tenant_name: string;
      expected: string;
      collected: string;
      due: string;
      status: string;
    }>(
      `
        SELECT
          rl.rent_month AS month,
          o.owner_name,
          s.shop_number,
          t.tenant_name,
          rl.rent_amount::text AS expected,
          rl.amount_paid::text AS collected,
          rl.remaining_due::text AS due,
          rl.payment_status::text AS status
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN owners o ON o.owner_id = s.owner_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        WHERE o.owner_name = ANY($2::text[])
          AND ($1::uuid IS NULL OR o.owner_id = $1)
        ORDER BY rl.rent_month ASC, o.owner_name ASC, s.shop_number ASC
      `,
      [ownerId, FIXED_OWNER_NAMES],
    );

    const tenantLedger = await app.db.query<{
      month: string;
      owner_name: string;
      tenant_name: string;
      shop_number: string;
      expected: string;
      collected: string;
      due: string;
      status: string;
    }>(
      `
        SELECT
          rl.rent_month AS month,
          o.owner_name,
          t.tenant_name,
          s.shop_number,
          rl.rent_amount::text AS expected,
          rl.amount_paid::text AS collected,
          rl.remaining_due::text AS due,
          rl.payment_status::text AS status
        FROM rent_ledgers rl
        JOIN shops s ON s.shop_id = rl.shop_id
        JOIN owners o ON o.owner_id = s.owner_id
        JOIN tenants t ON t.tenant_id = rl.tenant_id
        WHERE o.owner_name = ANY($2::text[])
          AND ($1::uuid IS NULL OR o.owner_id = $1)
        ORDER BY rl.rent_month ASC, o.owner_name ASC, t.tenant_name ASC, s.shop_number ASC
      `,
      [ownerId, FIXED_OWNER_NAMES],
    );

    const workbook = new ExcelJS.Workbook();

    const monthSheet = workbook.addWorksheet('Monthly Summary');
    monthSheet.addRow(['Month', 'Expected Amount', 'Collected Amount', 'Remaining Amount', 'Collection Percentage']);
    for (const row of monthlySummary.rows) {
      const expectedAmount = Number(row.expected);
      const collectedAmount = Number(row.collected);
      const remainingAmount = Number(row.remaining);
      const percentage = expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0;
      monthSheet.addRow([row.month, expectedAmount, collectedAmount, remainingAmount, percentage]);
    }
    styleWorksheet(monthSheet, [2, 3, 4, 5]);
    monthSheet.getColumn(5).numFmt = '0.00%';
    for (let i = 2; i <= monthSheet.rowCount; i += 1) {
      monthSheet.getCell(i, 5).value = (monthSheet.getCell(i, 5).value as number) / 100;
    }

    const ownerMonthSheet = workbook.addWorksheet('Owner-wise Monthly Summary');
    ownerMonthSheet.addRow([
      'Month',
      'Owner',
      'Expected Amount',
      'Collected Amount',
      'Remaining Amount',
      'Collection Percentage',
      'Tenant Names',
      'Shop Numbers',
    ]);
    for (const row of ownerMonthly.rows) {
      const expectedAmount = Number(row.expected);
      const collectedAmount = Number(row.collected);
      const remainingAmount = Number(row.remaining);
      const percentage = expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0;
      ownerMonthSheet.addRow([
        row.month,
        row.owner_name,
        expectedAmount,
        collectedAmount,
        remainingAmount,
        percentage,
        row.tenant_names,
        row.shop_numbers,
      ]);
    }
    styleWorksheet(ownerMonthSheet, [3, 4, 5, 6]);
    ownerMonthSheet.getColumn(6).numFmt = '0.00%';
    for (let i = 2; i <= ownerMonthSheet.rowCount; i += 1) {
      ownerMonthSheet.getCell(i, 6).value = (ownerMonthSheet.getCell(i, 6).value as number) / 100;
    }

    const shopLedgerSheet = workbook.addWorksheet('Shop-wise Ledger');
    shopLedgerSheet.addRow(['Month', 'Owner', 'Shop Number', 'Tenant Name', 'Expected Amount', 'Collected Amount', 'Due Amount', 'Status']);
    for (const row of shopLedger.rows) {
      shopLedgerSheet.addRow([
        row.month,
        row.owner_name,
        row.shop_number,
        row.tenant_name,
        Number(row.expected),
        Number(row.collected),
        Number(row.due),
        row.status,
      ]);
    }
    styleWorksheet(shopLedgerSheet, [5, 6, 7]);

    const tenantLedgerSheet = workbook.addWorksheet('Tenant-wise Ledger');
    tenantLedgerSheet.addRow(['Month', 'Owner', 'Tenant Name', 'Shop Number', 'Expected Amount', 'Collected Amount', 'Due Amount', 'Status']);
    for (const row of tenantLedger.rows) {
      tenantLedgerSheet.addRow([
        row.month,
        row.owner_name,
        row.tenant_name,
        row.shop_number,
        Number(row.expected),
        Number(row.collected),
        Number(row.due),
        row.status,
      ]);
    }
    styleWorksheet(tenantLedgerSheet, [5, 6, 7]);

    const data = await workbook.xlsx.writeBuffer();
    const fileName = `full-report-${fileTimestamp()}.xlsx`;
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(Buffer.from(data));
  });

  app.get('/reports/export', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = ExportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid export query' });
    }

    const q = parsed.data;
    const rows = await fetchReportRows(app, q.report_type, {
      fromMonth: q.from_month,
      toMonth: q.to_month,
    });

    const title = `Report ${q.report_type} ${new Date().toISOString().slice(0, 10)}`;
    const file = await buildReportFile(title, rows, q.format);

    reply.header('Content-Type', file.contentType);
    reply.header('Content-Disposition', `attachment; filename="${q.report_type}-${Date.now()}.${file.ext}"`);
    return reply.send(file.data);
  });
}
