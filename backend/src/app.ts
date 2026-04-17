import express from 'express';
import cors from 'cors';
import { initDb, isSeeded } from './db/database.js';
import { seedDb } from './db/seed-fn.js';
import router from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json());

// Initialize schema and auto-seed on cold start if empty
initDb();
if (!isSeeded()) seedDb();

app.use('/api', router);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
