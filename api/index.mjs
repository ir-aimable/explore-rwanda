// Vercel serverless function: the whole Express API (every /api/* request is rewritten here, see vercel.json).
// The server is compiled to server/dist during the build (`npm run build --prefix server`).
import { createApp } from '../server/dist/app.js';

export default createApp();
