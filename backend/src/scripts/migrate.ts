import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { env } from '../config/env';

async function run() {
  const sqlPath = path.resolve(__dirname, '..', 'db', 'schema.sql');
  const sql = await fs.readFile(sqlPath, 'utf8');

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await pool.query(sql);
    // eslint-disable-next-line no-console
    console.log('Schema migration completed');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
