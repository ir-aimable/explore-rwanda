import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors.js';

export const validateBody = (schema: ZodTypeAny) => (req: Request, _res: Response, next: NextFunction) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(badRequest('validation_error', 'Invalid input', flatten(r.error)));
  req.body = r.data;
  next();
};
function flatten(e: ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[i.path.join('.') || '_'] = i.message;
  return out;
}
