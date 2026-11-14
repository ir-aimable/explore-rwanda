import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
type Resolved = 'light' | 'dark';
interface Ctx { pref: ThemePref; theme: Resolved; setPref: (p: ThemePref) => void }

const KEY = 'er_theme';
const ThemeCtx = createContext<Ctx>(null as unknown as Ctx);
const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

/** Follows the device light/dark setting by default; a saved choice (light/dark) overrides it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => !!mq()?.matches);

  useEffect(() => {
    const m = mq(); if (!m) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  const theme: Resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
  useEffect(() => {
    const el = document.documentElement;
    if (el.dataset.theme === theme) return;
    // brief cross-fade only when the theme actually changes (never on first paint)
    el.classList.add('theme-anim'); el.dataset.theme = theme;
    const done = () => el.classList.remove('theme-anim');
    const h = window.setTimeout(done, 450);
    // also drop the class on cleanup so it can't get stuck (e.g. StrictMode re-running the effect)
    return () => { window.clearTimeout(h); done(); };
  }, [theme]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try { if (p === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ pref, theme, setPref }), [pref, theme, setPref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);
