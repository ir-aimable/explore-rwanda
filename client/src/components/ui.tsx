import { Icon, type IconName } from './Icon';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { ApiError } from '../services/api';

export function Spinner() { return <div className="spinner" role="status" aria-label="Loading" />; }

export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div>; }

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { tx, t } = useI18n();
  const code = error instanceof ApiError ? error.code : 'generic';
  return <div className="notice notice-red" role="alert">{tx('err.' + code, t('err.generic'))} {onRetry && <button className="link-btn" onClick={onRetry}>{t('c.reload')}</button>}</div>;
}

export function Loader({ loading, error, reload, children }: { loading: boolean; error: unknown; reload?: () => void; children: ReactNode }) {
  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  return <>{children}</>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // Callers pass a new onClose function on every render; keep the latest one in a ref so the effect
  // below runs only when the modal opens. Re-running it on each keystroke moved focus back to the first field.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); prev?.focus(); };
  }, []);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h3>{title}</h3>{children}
      </div>
    </div>
  );
}

/** Confirmation dialog for destructive actions. */
export function useConfirm() {
  const { t } = useI18n();
  const [st, setSt] = useState<{ msg: string; run: () => void | Promise<void>; danger?: boolean } | null>(null);
  const ask = (msg: string, run: () => void | Promise<void>, danger = true) => setSt({ msg, run, danger });
  const dialog = st ? (
    <Modal title={t('c.confirm')} onClose={() => setSt(null)}>
      <p>{st.msg}</p>
      <div className="row"><button className="btn btn-ghost" onClick={() => setSt(null)}>{t('c.cancel')}</button>
        <button className={`btn ${st.danger ? 'btn-danger' : ''}`} onClick={async () => { const r = st.run; setSt(null); await r(); }}>{t('c.confirm')}</button></div>
    </Modal>) : null;
  return { ask, dialog };
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  const { tx } = useI18n();
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className || ''}`}>
      <label>{label}</label>{children}
      {hint && <span className="hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{tx('err.' + error, tx('err.validation_error'))}</span>}
    </div>
  );
}

const TONE: Record<string, string> = { published: '', approved: '', open: '', resolved: '', visible: '', fully_booked: 'pill-gold', pending: 'pill-gold', in_progress: 'pill-gold', registration_closed: 'pill-grey', draft: 'pill-grey', completed: 'pill-grey', cancelled: 'pill-red', rejected: 'pill-red', suspended: 'pill-red', hidden: 'pill-grey', waitlisted: 'pill-gold' };
export function Status({ kind, value }: { kind: 'st' | 'rs' | 'as' | 'ss' | 'role'; value: string }) {
  const { tx } = useI18n();
  return <span className={`pill ${TONE[value] ?? 'pill-grey'}`}>{tx(`${kind}.${value}`, value)}</span>;
}

export function Stars({ n }: { n: number }) { return <span className="stars" aria-label={`${n} / 5`}>{'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}</span>; }

export function Logo() {
  return <img className="logo-img" src="/images/logo-sm.png" srcSet="/images/logo-sm.png 1x, /images/logo.png 4x" alt="" width={160} height={146} />;
}

export const initials = (name?: string) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
export function Avatar({ name, size }: { name?: string; size?: 'lg' }) { return <span className={`avatar ${size || ''}`} aria-hidden="true">{initials(name)}</span>; }


/** KPI tile: icon, big number, label. */
export function Kpi({ icon, value, label, tone }: { icon: IconName; value: number | string | undefined; label: string; tone?: 'gold' | 'red' }) {
  return (<div className={`kpi ${tone || ''}`}><span className="ic"><Icon name={icon} size={20} /></span><div><b>{value ?? '–'}</b><span>{label}</span></div></div>);
}

/** Part-to-whole donut with a labelled legend (values always visible, hover shows a tooltip). */
export function Donut({ data, label }: { data: { label: string; value: number; color: string }[]; label: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 42, c = 2 * Math.PI * r, gap = total > 0 && data.filter((d) => d.value > 0).length > 1 ? 2 : 0;
  let off = 0;
  return (
    <div className="donut-wrap">
      <svg width="150" height="150" viewBox="0 0 100 100" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--mist)" strokeWidth="13" />
        {total > 0 && data.map((d) => {
          const len = (d.value / total) * c; const seg = Math.max(0, len - gap);
          const el = d.value > 0 ? <circle key={d.label} cx="50" cy="50" r={r} fill="none" stroke={d.color} strokeWidth="13" strokeDasharray={`${seg} ${c - seg}`} strokeDashoffset={-off} transform="rotate(-90 50 50)"><title>{`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title></circle> : null;
          off += len; return el;
        })}
        <text x="50" y="49" textAnchor="middle" style={{ font: '400 16px var(--font-display)', fill: 'var(--ink)' }}>{total}</text>
        <text x="50" y="62" textAnchor="middle" style={{ font: '500 7px var(--font-body)', fill: 'var(--ink-soft)' }}>{label}</text>
      </svg>
      <ul className="legend">{data.map((d) => <li key={d.label}><i style={{ background: d.color }} />{d.label}<b>{d.value}{total > 0 && <span className="muted" style={{ fontWeight: 500 }}> · {Math.round((d.value / total) * 100)}%</span>}</b></li>)}</ul>
    </div>
  );
}
