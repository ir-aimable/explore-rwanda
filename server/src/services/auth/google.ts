// Verifies a Google Identity Services ID token (the "credential" from the Sign in with Google button)
// without extra dependencies: RS256 signature checked against Google's published keys, then the claims.
import crypto from 'node:crypto';

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_S = 60;

export interface GoogleProfile { sub: string; email: string; name: string; picture?: string }

let keys: { byKid: Map<string, crypto.KeyObject>; expires: number } | null = null;

/** Google's signing keys, cached for as long as Google's Cache-Control allows (refetched on an unknown key id). */
async function signingKey(kid: string): Promise<crypto.KeyObject | undefined> {
  if (keys && keys.expires > Date.now() && keys.byKid.has(kid)) return keys.byKid.get(kid);
  const r = await fetch(CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`google_certs_${r.status}`);
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') || '')?.[1] ?? 3600);
  const { keys: list } = await r.json() as { keys: (crypto.JsonWebKey & { kid: string })[] };
  keys = { byKid: new Map(list.map((k) => [k.kid, crypto.createPublicKey({ key: k, format: 'jwk' })])), expires: Date.now() + maxAge * 1000 };
  return keys.byKid.get(kid);
}

const b64json = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

/** The verified profile, or null when the token is not a valid, current Google ID token for one of our client IDs. */
export async function verifyGoogleCredential(credential: string, clientIds: string[]): Promise<GoogleProfile | null> {
  const parts = credential.split('.');
  if (parts.length !== 3) return null;
  let header: any, claims: any;
  try { header = b64json(parts[0]); claims = b64json(parts[1]); } catch { return null; }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

  const key = await signingKey(header.kid);
  if (!key) return null;
  const signed = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
  if (!signed) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!ISSUERS.has(claims.iss)) return null;
  if (!clientIds.includes(claims.aud)) return null;
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) return null;
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > now) return null;
  // Only a Google-verified email may sign in to (or be linked with) an account using that email.
  if (!claims.sub || !claims.email || (claims.email_verified !== true && claims.email_verified !== 'true')) return null;
  return { sub: String(claims.sub), email: String(claims.email).toLowerCase(), name: String(claims.name || claims.email.split('@')[0]).slice(0, 100), picture: claims.picture };
}

/** Tests only: use these public keys instead of fetching Google's (lets tests sign tokens with a local key). */
export function setGoogleKeysForTests(byKid: Map<string, crypto.KeyObject> | null) {
  keys = byKid ? { byKid, expires: Number.MAX_SAFE_INTEGER } : null;
}
