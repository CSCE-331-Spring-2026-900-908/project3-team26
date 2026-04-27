import express from 'express';
import cors from 'cors';
import { databaseHealthcheck } from './db/compat.js';
import menuRoutes from './routes/menu.js';
import inventoryRoutes from './routes/inventory.js';
import orderRoutes from './routes/orders.js';
import salesRoutes from './routes/sales.js';
import managerRoutes from './routes/manager.js';
import chatRouter from './routes/chat.js';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(',') || true,
  })
);
app.use(express.json());

app.get('/api/health', async (_req, res, next) => {
  try {
    const support = await databaseHealthcheck();
    res.json({ ok: true, service: 'bubble-tea-pos-api', support });
  } catch (error) {
    next(error);
  }
});

app.use('/api/menu', menuRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api', chatRouter);

app.use((error, _req, res, _next) => {
  console.error('[API ERROR]', error);
  const message = error.message || 'Unexpected server error';
  const status = message.toLowerCase().includes('not found') ? 404 : 500;
  res.status(status).json({ error: message });
});

export default app;
