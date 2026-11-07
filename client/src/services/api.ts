export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: Record<string, string>) { super(code); }
}
async function request<T>(method: string, url: string, body?: unknown, form?: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api' + url, {
      method, credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch { throw new ApiError(0, 'network'); }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.error || (res.status >= 500 ? 'server_error' : 'generic'), data?.details);
  return data as T;
}
export const api = {
  get: <T = any>(u: string) => request<T>('GET', u),
  post: <T = any>(u: string, b: unknown = {}) => request<T>('POST', u, b),
  put: <T = any>(u: string, b: unknown = {}) => request<T>('PUT', u, b),
  patch: <T = any>(u: string, b: unknown = {}) => request<T>('PATCH', u, b),
  del: <T = any>(u: string) => request<T>('DELETE', u),
  upload: <T = any>(u: string, file: File) => { const f = new FormData(); f.append('image', file); return request<T>('POST', u, undefined, f); },
};
export const qs = (o: Record<string, string | number | undefined | null | boolean>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v)); });
  const s = p.toString(); return s ? '?' + s : '';
};
