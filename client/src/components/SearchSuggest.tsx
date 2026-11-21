import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { api, qs } from '../services/api';
import { Icon, type IconName } from './Icon';

export interface Suggestion {
  type: 'destination' | 'trip' | 'experience' | 'activity' | 'place';
  label: string; sub?: string; value: string; link: string; free?: boolean;
}
const ICON: Record<Suggestion['type'], IconName> = { destination: 'pin', trip: 'calendar', experience: 'star', activity: 'mountain', place: 'map' };

/** The typed text in bold inside a suggestion ("Nya" in "Nyandungu"), ignoring case and accents. */
function Highlight({ text, q }: { text: string; q: string }) {
  const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const i = q ? plain(text).indexOf(plain(q.trim())) : -1;
  if (i < 0) return <>{text}</>;
  const n = q.trim().length;
  return <>{text.slice(0, i)}<b>{text.slice(i, i + n)}</b>{text.slice(i + n)}</>;
}

/**
 * Search box with suggestions as you type: destinations, trips, things to do, activities and places in Rwanda.
 * Arrow keys move through them, Enter picks one (or searches what was typed), Escape closes the list.
 * The list is drawn over the page (not inside the search bar) so a hero with hidden overflow can't cut it off;
 * `anchor` is the CSS selector of the element it lines up with (default: the box itself).
 */
export function SearchSuggest({ value, onChange, id, placeholder, onPick, anchor }: {
  value: string; onChange: (v: string) => void; id: string; placeholder?: string; onPick?: (s: Suggestion) => void; anchor?: string;
}) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const typed = useRef(false); // suggestions only for what the user typed, not for a value set by picking one

  useEffect(() => {
    if (!typed.current || value.trim().length < 2) { setItems([]); return; }
    let live = true;
    const h = setTimeout(() => api.get<{ items: Suggestion[] }>(`/search/suggest${qs({ q: value, lang })}`)
      .then((r) => { if (live) { setItems(r.items); setActive(-1); } }).catch(() => live && setItems([])), 160);
    return () => { live = false; clearTimeout(h); };
  }, [value, lang]);

  const open = focused && items.length > 0;
  // Keep the list under the search bar while the page scrolls or resizes
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = (anchor && input.current?.closest(anchor)) || input.current?.parentElement;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({ left: r.left, top: r.bottom + 8, width: r.width });
    };
    place();
    window.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open, anchor]);

  const pick = (s: Suggestion) => { typed.current = false; onChange(s.value); setItems([]); input.current?.blur(); onPick?.(s); };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === 'Escape') { setItems([]); }
  };
  const typeName = (s: Suggestion) => t(`sg.${s.type}` as any);

  return (<>
    <input ref={input} id={id} value={value} placeholder={placeholder} autoComplete="off" spellCheck={false}
      role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      onChange={(e) => { typed.current = true; onChange(e.target.value); }} onKeyDown={onKey}
      onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 120)} />
    {open && box && createPortal(
      <ul id={listId} role="listbox" className="suggest" style={{ left: box.left, top: box.top, width: box.width }} aria-label={t('sg.title')}>
        {items.map((s, i) => (
          <li key={`${s.type}-${s.link}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'on' : ''}
            onMouseDown={(e) => { e.preventDefault(); pick(s); }} onMouseEnter={() => setActive(i)}>
            <span className={`sg-ico sg-${s.type}`}><Icon name={ICON[s.type]} size={16} /></span>
            <span className="sg-text"><span className="sg-label"><Highlight text={s.label} q={value} /></span>{s.sub && <span className="sg-sub">{s.sub}</span>}</span>
            {s.free && <span className="sg-free">{t('dest.free')}</span>}
            <span className="sg-type">{typeName(s)}</span>
          </li>
        ))}
      </ul>, document.body)}
  </>);
}
