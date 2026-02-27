import fs from 'node:fs/promises';
import { FastifyInstance } from 'fastify';

interface InvoiceFileRow {
  pdf_storage_path: string;
}

export async function publicInvoiceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/public/invoices/:token', { config: { auth: false } }, async (request, reply) => {
    const token = (request.params as { token: string }).token;

    const result = await app.db.query<InvoiceFileRow>(
      `
        SELECT pdf_storage_path
        FROM invoices
        WHERE public_token = $1
          AND public_url_expires_at > NOW()
        LIMIT 1
      `,
      [token],
    );

    const row = result.rows[0];
    if (!row) {
      return reply.code(404).send({ message: 'Invalid or expired invoice link' });
    }

    let file: Buffer;
    try {
      file = await fs.readFile(row.pdf_storage_path);
    } catch {
      return reply.code(404).send({ message: 'Invoice file not found' });
    }
    reply.header('Content-Type', 'application/pdf');
    reply.header('Cache-Control', 'private, max-age=60');
    return reply.send(file);
  });
}
