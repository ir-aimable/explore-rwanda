import { createApp, ready } from './app.js';
import { env } from './config/env.js';

await ready();
createApp().listen(env.port, () => {
  console.log(`[server] Explore Rwanda API listening on http://localhost:${env.port}`);
});
