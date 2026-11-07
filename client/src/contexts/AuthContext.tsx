import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { User } from '../types';

interface Ctx { user: User | null; ready: boolean; refresh: () => Promise<void>; login: (e: string, p: string) => Promise<User>; register: (b: any) => Promise<User>; logout: () => Promise<void> }
const C = createContext<Ctx>(null as unknown as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try { const r = await api.get<{ user: User | null }>('/auth/me'); setUser(r.user); } catch { setUser(null); }
    setReady(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const login = async (email: string, password: string) => { const r = await api.post<{ user: User }>('/auth/login', { email, password }); setUser(r.user); return r.user; };
  const register = async (b: any) => { const r = await api.post<{ user: User }>('/auth/register', b); setUser(r.user); return r.user; };
  const logout = async () => { await api.post('/auth/logout'); setUser(null); };
  return <C.Provider value={{ user, ready, refresh, login, register, logout }}>{children}</C.Provider>;
}
export const useAuth = () => useContext(C);
export const homeFor = (u: User) => (u.role === 'admin' ? '/admin' : u.role === 'organizer' ? '/organizer' : '/traveler');
