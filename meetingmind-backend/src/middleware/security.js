import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Rate limiter: 1000 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload limiter: 100 uploads per hour
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: true,
  message: 'Too many uploads. Please try again in 1 hour.',
});

// Helmet middleware (already applied in server.js)
export const securityHeaders = helmet();
