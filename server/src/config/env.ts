import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
// Load repo-root .env first, then server/.env (server overrides)
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'server', '.env') });

const serverDir = path.resolve(here, '../..');
const isProd = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.startsWith('change-me')) {
  if (isProd) throw new Error('JWT_SECRET must be set to a strong random value in production.');
  // Dev convenience: ephemeral secret (sessions reset on restart). Never a shipped default.
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('[config] JWT_SECRET not set - using an ephemeral secret (sessions reset on restart).');
}

export const env = {
  isProd,
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret,
  databasePath: path.resolve(serverDir, process.env.DATABASE_PATH || './data/explore-rwanda.db'),
  uploadDir: path.resolve(serverDir, process.env.UPLOAD_DIR || '../uploads'),
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminName: process.env.ADMIN_NAME || 'Platform Administrator',
  demoPassword: process.env.DEMO_PASSWORD || '',
  ollamaUrl: process.env.OLLAMA_URL || '',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
  weatherEnabled: (process.env.WEATHER_ENABLED || 'true') !== 'false',
  googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '',
  clientDist: path.resolve(serverDir, '../client/dist'),
};
