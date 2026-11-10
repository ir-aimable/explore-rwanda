import { db } from '../../database/db.js';

/** In-app notification. `type` + `data` are translated on the client (rw/en). Email is optional and not required. */
export async function notify(userId: number, type: string, data: Record<string, unknown> = {}, link?: string) {
  await db.prepare('INSERT INTO notifications (user_id,type,data,link) VALUES (?,?,?,?)')
    .run(userId, type, JSON.stringify(data), link ?? null);
}
export async function notifyAdmins(type: string, data: Record<string, unknown> = {}, link?: string) {
  const admins = await db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1").all() as { id: number }[];
  for (const a of admins) await notify(a.id, type, data, link);
}
