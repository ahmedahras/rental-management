import 'fastify';
import { Db } from '../types';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }

  interface FastifyRequest {
    user: {
      admin_id: number;
      username: string;
    };
  }
}
