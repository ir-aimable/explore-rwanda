import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

// Isolated environment: temp DB + temp uploads, so tests never touch demo data.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'er-test-'));
process.env.DATABASE_PATH = path.join(tmp, 'test.db');
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.ADMIN_EMAIL = 'admin@test.local';
process.env.ADMIN_PASSWORD = 'TestAdminPass123';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-test-secret';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.OLLAMA_URL = '';
process.env.WEATHER_ENABLED = 'false';

const { createApp } = await import('../app.js');
export const { setFixedNow } = await import('../lib/time.js');
export const { db } = await import('../database/db.js');
const server = createApp().listen(0);
export const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
export const closeServer = () => { server.close(); };

export class Client {
  cookie = '';
  async req(method: string, url: string, body?: unknown, raw?: { form?: FormData }) {
    const headers: Record<string, string> = {};
    if (this.cookie) headers.cookie = this.cookie;
    let payload: any;
    if (raw?.form) payload = raw.form; else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(base + url, { method, headers, body: payload });
    const sc = r.headers.getSetCookie?.() ?? [];
    for (const c of sc) { const kv = c.split(';')[0]; if (kv.endsWith('=')) this.cookie = ''; else this.cookie = kv; }
    let json: any = null; const text = await r.text();
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, json, text };
  }
  get = (u: string) => this.req('GET', u);
  post = (u: string, b?: unknown) => this.req('POST', u, b ?? {});
  put = (u: string, b?: unknown) => this.req('PUT', u, b ?? {});
  patch = (u: string, b?: unknown) => this.req('PATCH', u, b ?? {});
  del = (u: string) => this.req('DELETE', u);
}

// ---- Result recorder that feeds the real test report ----
export interface Row { id: string; desc: string; expected: string; actual: string; pass: boolean; notes: string }
export const rows: Row[] = [];
export async function T(id: string, desc: string, expected: string, fn: () => Promise<string | void>, notes = '') {
  try {
    const actual = (await fn()) || 'Matched expected result (all assertions passed)';
    rows.push({ id, desc, expected, actual, pass: true, notes });
  } catch (e: any) {
    rows.push({ id, desc, expected, actual: String(e?.message || e).slice(0, 300), pass: false, notes });
    throw e;
  }
}
export function writeReport(file: string) {
  const pass = rows.filter((r) => r.pass).length;
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const out = [
    '# Explore Rwanda - Automated Test Report', '',
    `Generated: ${new Date().toISOString()} by \`npm test\` (server/src/tests). Results below are produced by the test run itself, not written by hand.`, '',
    `**Total: ${rows.length} | Passed: ${pass} | Failed: ${rows.length - pass}**`, '',
    '| Test ID | Description | Expected result | Actual result | Pass/Fail | Notes |', '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${esc(r.desc)} | ${esc(r.expected)} | ${esc(r.actual)} | ${r.pass ? 'PASS' : 'FAIL'} | ${esc(r.notes)} |`), '',
  ];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n'));
}
