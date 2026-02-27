import argon2 from 'argon2';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

interface AdminRow {
  admin_id: number;
  username: string;
  password_hash: string;
  is_active: boolean;
}

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid login payload' });
    }

    const { username, password } = parsed.data;
    const result = await app.db.query<AdminRow>(
      `SELECT admin_id, username, password_hash, is_active FROM admins WHERE username = $1 LIMIT 1`,
      [username],
    );

    const admin = result.rows[0];
    if (!admin || !admin.is_active) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const verified = await argon2.verify(admin.password_hash, password);
    if (!verified) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ admin_id: admin.admin_id, username: admin.username });
    return reply.send({ access_token: token, expires_in: 60 * 60 * 12 });
  });
}
