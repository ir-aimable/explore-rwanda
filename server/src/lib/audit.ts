import type { Request } from 'express';
import { db } from '../database/db.js';

export function audit(req: Request | null, actor: { id: number; email: string } | null, action: string,
  entity?: string, entityId?: number, details?: unknown) {
  db.prepare('INSERT INTO audit_logs (actor_id,actor_email,action,entity,entity_id,details,ip) VALUES (?,?,?,?,?,?,?)')
    .run(actor?.id ?? null, actor?.email ?? null, action, entity ?? null, entityId ?? null,
      details ? JSON.stringify(details) : null, req?.ip ?? null);
}
