import argon2 from 'argon2';
import { Pool } from 'pg';
import { env } from '../config/env';

async function run() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    const hash = await argon2.hash(env.ADMIN_PASSWORD, { type: argon2.argon2id });
    await pool.query(
      `
        INSERT INTO admins(username, password_hash, is_active)
        VALUES ($1, $2, TRUE)
        ON CONFLICT (username)
        DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE
      `,
      [env.ADMIN_USERNAME, hash],
    );

    // eslint-disable-next-line no-console
    console.log(`Admin seeded: ${env.ADMIN_USERNAME}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
