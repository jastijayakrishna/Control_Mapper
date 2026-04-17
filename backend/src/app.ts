import express from 'express';
import cors from 'cors';
import { ensureInit, initDb, isSeeded } from './db/database.js';
import { seedDb } from './db/seed-fn.js';
import router from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json());

// Async boot: initialize sql.js, create schema, auto-seed if empty
let booted = false;
async function boot() {
  if (booted) return;
  await ensureInit();
  initDb();
  if (!isSeeded()) seedDb();
  booted = true;
}

// Middleware: ensure DB is ready before any request
app.use(async (_req, _res, next) => {
  try {
    await boot();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api', router);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
