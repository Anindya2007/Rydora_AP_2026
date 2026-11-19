import express, { type Application } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiV1Router } from './routes/index.js';

export const app: Application = express();

// Disable powered-by header for basic security
app.disable('x-powered-by');

// 1. Attach Request ID to every incoming request
app.use(requestIdMiddleware);

// 2. Cross-Origin Resource Sharing (CORS) with environment-aware origins
const isWildcardOrigin = env.CORS_ORIGIN.trim() === '*';
const allowedOrigins = isWildcardOrigin
  ? '*'
  : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    // Disallow credentials when using wildcard origin to satisfy W3C/MDN security specs
    credentials: !isWildcardOrigin,
  })
);

// 3. Body Parsing with payload limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Mount Central API v1 Router
app.use('/api/v1', apiV1Router);

// 5. Fallback 404 Handler for Unmatched Routes
app.use(notFoundHandler);

// 6. Centralized Error Handler (must be mounted last)
app.use(errorHandler);
