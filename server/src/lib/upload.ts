import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { badRequest } from './errors.js';

fs.mkdirSync(env.uploadDir, { recursive: true });
const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (EXT[file.mimetype] || '.bin')),
  }),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(badRequest('invalid_file_type') as any)),
}).single('image');

/** Verify magic bytes so a renamed non-image is rejected even if the mimetype header lies. */
export function verifyImageFile(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  return jpeg || png || webp;
}
export function removeUpload(publicPath: string | null | undefined) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  try { fs.unlinkSync(path.join(env.uploadDir, path.basename(publicPath))); } catch { /* ignore */ }
}
