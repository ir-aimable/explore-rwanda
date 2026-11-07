import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type Key } from './en';
import { rw } from './rw';

export type Lang = 'rw' | 'en';
const dicts: Record<Lang, Record<Key, string>> = { en, rw };
type Params = Record<string, string | number | undefined>;

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, p?: Params) => string; tx: (k: string, fallback?: string, p?: Params) => string; fmtDate: (d: string) => string; money: (n: number) => string }
const I18n = createContext<Ctx>(null as unknown as Ctx);

function interpolate(s: string, p?: Params) { return p ? s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? '')) : s; }

export function I18nProvider({ children }: { children: ReactNode }) {
  // Kinyarwanda is the default interface language.
  const [lang, setLangState] = useState<Lang>(() => { try { return (localStorage.getItem('er_lang') as Lang) || 'rw'; } catch { return 'rw'; } });
  const setLang = useCallback((l: Lang) => { setLangState(l); try { localStorage.setItem('er_lang', l); } catch { /* ignore */ } }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const value = useMemo<Ctx>(() => ({
    lang, setLang,
    t: (k, p) => interpolate(dicts[lang][k] ?? en[k] ?? k, p),
    tx: (k, fallback, p) => interpolate((dicts[lang] as Record<string, string>)[k] ?? (en as Record<string, string>)[k] ?? fallback ?? k, p),
    fmtDate: (d) => {
      if (!d) return '';
      const [y, m, day] = d.slice(0, 10).split('-').map(Number);
      const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
      const W = lang === 'rw' ? ['Cyu', 'Mbe', 'Kab', 'Gtu', 'Kan', 'Gtn', 'Gnd'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const M = lang === 'rw' ? ['Mut', 'Gas', 'Wer', 'Mat', 'Gic', 'Kam', 'Nya', 'Kan', 'Nze', 'Ukw', 'Ugu', 'Uku'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${W[wd]} ${day} ${M[m - 1]} ${y}`;
    },
    money: (n) => `RWF ${n.toLocaleString('en-US')}`,
  }), [lang, setLang]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
