import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { env } from './config/env';
import { authPlugin } from './plugins/auth';
import { dbPlugin } from './plugins/db';
import { authRoutes } from './routes/auth';
import { dashboardRoutes } from './routes/dashboard';
import { ownerRoutes } from './routes/owners';
import { shopRoutes } from './routes/shops';
import { tenantRoutes } from './routes/tenants';
import { rentRoutes } from './routes/rents';
import { invoiceRoutes } from './routes/invoices';
import { publicInvoiceRoutes } from './routes/public-invoices';
import { reportRoutes } from './routes/reports';
import { paymentRoutes } from './routes/payments';
import { PaymentService } from './services/payment.service';
import { healthRoutes } from './routes/health';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
  });
  await app.register(sensible);

  await app.register(dbPlugin);
  await app.register(authPlugin);

  await authRoutes(app);
  await publicInvoiceRoutes(app);
  await healthRoutes(app);

  const paymentService = new PaymentService(app.db, env.PUBLIC_BASE_URL, env.INVOICE_STORAGE_ROOT);

  await dashboardRoutes(app);
  await ownerRoutes(app);
  await shopRoutes(app);
  await tenantRoutes(app);
  await rentRoutes(app);
  await paymentRoutes(app, paymentService);
  await invoiceRoutes(app);
  await reportRoutes(app);

  app.get('/', async () => ({ status: 'ok', service: 'rental-management' }));

  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    if (status >= 500) {
      app.log.error(error);
    }
    reply.code(status).send({ message });
  });

  return app;
}
