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
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('keydown', k); prev?.focus(); };
  }, [onClose]);
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
  return (<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="3" fill="#1f4d3a" /><path d="M3 25l8-12 5 6 4-5 9 11z" fill="#c9a24a" /><circle cx="23" cy="9" r="3" fill="#f6ecd2" /></svg>);
}
