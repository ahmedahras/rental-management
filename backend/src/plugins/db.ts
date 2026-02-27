import fp from 'fastify-plugin';
import { Pool, PoolClient } from 'pg';
import { env } from '../config/env';
import { Db } from '../types';

function createTx(client: PoolClient): Db {
  return {
    async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[] };
    },
    async withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      return fn(createTx(client));
    },
  };
}

export const dbPlugin = fp(async (app) => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
  });

  const db: Db = {
    async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },

    async withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = createTx(client);
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };

  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await pool.end();
  });
});
