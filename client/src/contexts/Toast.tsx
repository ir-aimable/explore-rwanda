import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { ApiError } from '../services/api';
import { useI18n } from '../i18n';

interface T { id: number; text: string; kind: 'ok' | 'err' }
const C = createContext<{ ok: (m: string) => void; fail: (e: unknown) => void }>(null as any);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const { tx } = useI18n();
  const push = useCallback((text: string, kind: T['kind']) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 5000);
  }, []);
  const ok = useCallback((m: string) => push(m, 'ok'), [push]);
  const fail = useCallback((e: unknown) => {
    const code = e instanceof ApiError ? (e.code === 'network' || e.status === 0 ? 'network' : e.code) : 'generic';
    push(tx('err.' + code, tx('err.generic')), 'err');
  }, [push, tx]);
  return (
    <C.Provider value={{ ok, fail }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}</div>
    </C.Provider>
  );
}
export const useToast = () => useContext(C);
