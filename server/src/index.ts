import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { testConnection } from './utils/db';
import { errorHandler, cors as corsMiddleware, asyncHandler, AuthRequest } from './middleware';
import eventRoutes from './routes/events';
import alertRoutes from './routes/alerts';
import dashboardRoutes from './routes/dashboard';
import managementRoutes from './routes/management';
import dictionaryRoutes from './routes/dictionaries';
import authRoutes from './routes/auth';
import adminDictRoutes from './routes/adminDictionaries';

// Load environment variables from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });
dotenv.config({ path: join(__dirname, '../.env') });

const app: Express = express();
const PORT = process.env.PORT || 3001;

// ================================
// Middleware
// ================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(corsMiddleware);

// ================================
// Mock Authentication Middleware
// ================================
// In production, you should implement proper JWT authentication
app.use((req: any, res, next) => {
  // Extract organization_id from header or query
  const organizationId = req.headers['x-organization-id'] || req.query.organization_id;

  if (!organizationId) {
    // For demo purposes, use a default org ID
    req.organization_id = '00000000-0000-0000-0000-000000000001';
  } else {
    req.organization_id = organizationId;
  }

  // Mock user
  req.user = {
    id: 'demo-user-id',
    email: 'demo@example.com',
    organization_id: req.organization_id,
  };

  next();
});

// ================================
// Health Check
// ================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Same-origin image proxy for remote links that block direct browser hotlinking.
app.get('/api/image-proxy', (req, res) => {
  const rawUrl = String(req.query.url || '').trim();

  if (!rawUrl) {
    res.status(400).json({ success: false, error: 'Missing url' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ success: false, error: 'Invalid url' });
    return;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    res.status(400).json({ success: false, error: 'Only http/https supported' });
    return;
  }

  const client = parsed.protocol === 'https:' ? httpsGet : httpGet;
  const request = client(
    parsed,
    {
      headers: {
        'user-agent': 'Mozilla/5.0 ImageProxy/1.0',
        accept: 'image/*,*/*;q=0.8',
      },
      timeout: 12000,
    },
    (upstream) => {
      const status = upstream.statusCode || 502;
      if (status >= 400) {
        res.status(502).json({ success: false, error: `Upstream returned ${status}` });
        upstream.resume();
        return;
      }

      const contentType = upstream.headers['content-type'];
      if (typeof contentType === 'string' && contentType.length > 0) {
        res.setHeader('Content-Type', contentType);
      } else {
        res.setHeader('Content-Type', 'image/jpeg');
      }
      if (typeof upstream.headers['content-length'] === 'string') {
        res.setHeader('Content-Length', upstream.headers['content-length']);
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');

      upstream.pipe(res);
    }
  );

  request.on('timeout', () => {
    request.destroy(new Error('Upstream timeout'));
  });

  request.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: 'Failed to fetch remote image' });
    }
  });
});

// ================================
// API Routes
// ================================
const apiPrefix = process.env.API_PREFIX || '/api';

app.use(`${apiPrefix}/events`, eventRoutes);
app.use(`${apiPrefix}/alerts`, alertRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/management`, managementRoutes);
app.use(`${apiPrefix}/dictionaries`, dictionaryRoutes);
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/admin/dictionaries`, adminDictRoutes);

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'Sentry Intelligence Backend API',
    version: '1.0.0',
    endpoints: {
      auth: `${apiPrefix}/auth`,
      dashboard: `${apiPrefix}/dashboard`,
      events: `${apiPrefix}/events`,
      alerts: `${apiPrefix}/alerts`,
      management: `${apiPrefix}/management`,
      dictionaries: `${apiPrefix}/dictionaries`,
      admin_dictionaries: `${apiPrefix}/admin/dictionaries`,
    },
    docs: 'See README.md for detailed API documentation',
  });
});

// ================================
// 404 Handler
// ================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

// ================================
// Error Handler
// ================================
app.use(errorHandler);

// ================================
// Server Startup
// ================================
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('Failed to connect to database. Continuing anyway...');
    }

    app.listen(PORT, () => {
      console.log(`\n✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ API Base URL: http://localhost:${PORT}${apiPrefix}`);
      console.log(`✓ Health Check: http://localhost:${PORT}/health`);
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log('API Endpoints:');
      console.log(`  GET  ${apiPrefix}/dashboard               - Get dashboard data`);
      console.log(`  GET  ${apiPrefix}/events                 - List events`);
      console.log(`  POST ${apiPrefix}/events                 - Create event`);
      console.log(`  GET  ${apiPrefix}/events/:id             - Get event detail`);
      console.log(`  GET  ${apiPrefix}/alerts                 - List alerts`);
      console.log(`  GET  ${apiPrefix}/management/products    - List products`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
