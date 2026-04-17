import express from 'express';
import cors from 'cors';
import { initDb } from './db/database.js';
import router from './routes/index.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDb();

// Routes
app.use('/api', router);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✓ Control Mapper API running on http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Catalog: http://localhost:${PORT}/api/catalog/versions`);
  console.log(`  Mapping: http://localhost:${PORT}/api/customers/demo-customer/mapping`);
});

export default app;
