import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import receiptRoutes from './routes/receiptRoutes';
import settingsRoutes from './routes/settingsRoutes';
import eventRoutes from './routes/eventRoutes';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;
const parseOrigins = (raw: string | undefined): string[] =>
  raw
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://kit.dev.9rum.cc:5173',
  'https://kit.dev.9rum.cc',
  'http://kit.dev.9rum.cc',
];

const allowedOrigins = [
  ...new Set([...parseOrigins(process.env.ALLOWED_ORIGINS), ...defaultOrigins]),
];

const jsonBodyLimit = process.env.JSON_BODY_LIMIT ?? '15mb';
const urlEncodedBodyLimit = process.env.URLENCODED_BODY_LIMIT ?? jsonBodyLimit;

const isOriginAllowed = (origin: string): boolean => {
  const normalized = origin.replace(/\/$/, '');
  const withoutPort = normalized.replace(/:\d+$/, '');

  return allowedOrigins.some((allowed) => {
    const allowedNormalized = allowed.replace(/\/$/, '');
    const allowedWithoutPort = allowedNormalized.replace(/:\d+$/, '');
    return (
      allowedNormalized === normalized ||
      allowedWithoutPort === normalized ||
      allowedNormalized === withoutPort ||
      allowedWithoutPort === withoutPort
    );
  });
};

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: urlEncodedBodyLimit }));

// Static file serving for uploads
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/events', eventRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API: http://localhost:${PORT}`);
});

export default app;
