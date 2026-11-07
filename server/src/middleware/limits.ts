import rateLimit from 'express-rate-limit';

const make = (windowMs: number, limit: number) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
    message: { error: 'too_many_requests' } });
export const authLimiter = make(15 * 60 * 1000, 30);      // login / register
export const publicFormLimiter = make(60 * 60 * 1000, 20); // support, applications
export const aiLimiter = make(60 * 1000, 40);
export const apiLimiter = make(60 * 1000, 600);
