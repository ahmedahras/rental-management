import { buildApp } from './app';
import { env } from './config/env';

async function start() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: env.HOST });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
