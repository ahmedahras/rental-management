import { buildApp } from './app';

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';
  await app.listen({ port, host });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
