import { db } from '../../database/db.js';

/** In-app notification. `type` + `data` are translated on the client (rw/en). Email is optional and not required. */
export function notify(userId: number, type: string, data: Record<string, unknown> = {}, link?: string) {
  db.prepare('INSERT INTO notifications (user_id,type,data,link) VALUES (?,?,?,?)')
    .run(userId, type, JSON.stringify(data), link ?? null);
}
export function notifyAdmins(type: string, data: Record<string, unknown> = {}, link?: string) {
  const admins = db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1").all() as { id: number }[];
  admins.forEach((a) => notify(a.id, type, data, link));
}
