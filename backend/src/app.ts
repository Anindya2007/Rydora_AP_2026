import express, { type Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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
  ? true
  : env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-session-id'],
    credentials: true,
  })
);

// 3. Cookie Parsing Middleware
app.use(cookieParser());

// 4. Body Parsing with payload limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Mount Central API v1 Router
app.use('/api/v1', apiV1Router);

// 6. Fallback 404 Handler for Unmatched Routes
app.use(notFoundHandler);

// 7. Centralized Error Handler (must be mounted last)
app.use(errorHandler);
