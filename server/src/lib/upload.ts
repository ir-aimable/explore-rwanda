// Image uploads (trip photos, destination photos).
//  - On Vercel (BLOB_READ_WRITE_TOKEN set): stored in Vercel Blob; the database keeps the public https URL.
//  - Locally: stored in UPLOAD_DIR and served at /uploads/<file>.
// Files are held in memory (max 4 MB, under Vercel's 4.5 MB request limit) and their bytes are checked
// before anything is stored, so a renamed non-image is rejected even if the mimetype header lies.
import type { Request, Response } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { badRequest } from './errors.js';

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const useBlob = !!env.blobToken;
if (!useBlob) { try { fs.mkdirSync(env.uploadDir, { recursive: true }); } catch { /* read-only file system */ } }

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(badRequest('invalid_file_type') as any)),
}).single('image');

/** Magic bytes: JPEG, PNG or WebP. */
export function isImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  return jpeg || png || webp;
}

/** Parses the multipart request, validates the image and stores it. Returns the public path or URL. */
export async function receiveImage(req: Request, res: Response): Promise<string> {
  await new Promise<void>((resolve, reject) => parser(req, res, (err: any) => {
    if (err) return reject(err.code === 'LIMIT_FILE_SIZE' ? badRequest('file_too_large') : err);
    resolve();
  }));
  const file = req.file;
  if (!file) throw badRequest('file_required');
  if (!isImage(file.buffer)) throw badRequest('invalid_file_type');
  const name = crypto.randomBytes(16).toString('hex') + EXT[file.mimetype];
  if (useBlob) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${name}`, file.buffer, { access: 'public', contentType: file.mimetype, token: env.blobToken, addRandomSuffix: false });
    return blob.url;
  }
  await fs.promises.writeFile(path.join(env.uploadDir, name), file.buffer);
  return '/uploads/' + name;
}

/** Deletes a stored upload (local file or Vercel Blob). Bundled demo images and unknown paths are left alone. */
export async function removeUpload(p: string | null | undefined) {
  if (!p) return;
  try {
    if (p.startsWith('/uploads/')) await fs.promises.unlink(path.join(env.uploadDir, path.basename(p)));
    else if (useBlob && /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(p)) {
      const { del } = await import('@vercel/blob');
      await del(p, { token: env.blobToken });
    }
  } catch { /* already gone */ }
}
