// app.js: builds and exports the Express application.
// Registers CORS, JSON body parsing, all API route groups, and the global error handler.
// server.js imports this and calls app.listen(); tests can import it directly.
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

// Allow requests from the frontend origin(s) listed in FRONTEND_URL (comma-separated).
// Falls back to allowing all origins when the variable is not set (local dev).
app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(',') || true,
  })
);
app.use(express.json());

// Health check: pings the database and returns which optional schema features are present.
// Used by Render and other hosts to verify the service is up.
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

// Global error handler: catches anything thrown by a route and returns a JSON error response.
// Messages containing "not found" get a 404; everything else gets a 500.
app.use((error, _req, res, _next) => {
  console.error('[API ERROR]', error);
  const message = error.message || 'Unexpected server error';
  const status = message.toLowerCase().includes('not found') ? 404 : 500;
  res.status(status).json({ error: message });
});

export default app;
