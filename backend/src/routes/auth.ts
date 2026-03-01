import argon2 from 'argon2';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env';

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

const RefreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
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

    const accessToken = app.jwt.sign({ admin_id: admin.admin_id, username: admin.username });
    const refreshToken = app.jwt.sign(
      { admin_id: admin.admin_id, username: admin.username, token_type: 'refresh' },
      {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      },
    );

    return reply.send({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 60 * 60 * 12,
    });
  });

  app.post('/auth/refresh', async (request, reply) => {
    const parsed = RefreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Invalid refresh payload' });
    }

    const token = parsed.data.refreshToken ?? parsed.data.refresh_token;
    if (!token) {
      return reply.code(400).send({ message: 'refreshToken is required' });
    }

    try {
      const payload = app.jwt.verify<{
        admin_id: number;
        username: string;
        token_type?: string;
      }>(token);

      if (payload.token_type != null && payload.token_type != 'refresh') {
        return reply.code(401).send({ message: 'Invalid refresh token' });
      }

      const nextAccessToken = app.jwt.sign({
        admin_id: payload.admin_id,
        username: payload.username,
      });

      return reply.send({ access_token: nextAccessToken });
    } catch {
      return reply.code(401).send({ message: 'Invalid or expired refresh token' });
    }
  });

  app.post('/auth/logout', async (_request, reply) => {
    return reply.code(204).send();
  });
}
