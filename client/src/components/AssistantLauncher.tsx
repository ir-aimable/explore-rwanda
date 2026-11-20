import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Icon, Robot } from './Icon';
import { Spinner } from './ui';

// The chat code loads only when the visitor first opens it.
const Assistant = lazy(() => import('./Assistant').then((m) => ({ default: m.Assistant })));

/**
 * Floating "Ask Explore Rwanda Assistant" button, bottom-right on every page except the admin dashboard
 * (and /planner, which already shows the full assistant). The chat stays mounted once opened, so closing
 * and reopening it keeps the conversation.
 */
export function AssistantLauncher() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hidden = pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/planner';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => { if (hidden) setOpen(false); }, [hidden]);

  if (hidden) return null;
  const label = t('ai.launcher');
  return (
    <div className="ai-dock">
      {mounted && (
        <div className="ai-pop" role="dialog" aria-label={t('ai.title')} hidden={!open}>
          <div className="ai-pop-head">
            <Robot size={36} small />
            <strong className="grow">{t('ai.title')}</strong>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={t('c.close')}><Icon name="x" size={18} /></button>
          </div>
          <Suspense fallback={<div className="ai-pop-load"><Spinner /></div>}><Assistant compact /></Suspense>
        </div>
      )}
      <button type="button" className={`ai-fab ${open ? 'open' : ''}`} aria-expanded={open} aria-label={open ? t('c.close') : label}
        onClick={() => { setMounted(true); setOpen((o) => !o); }}>
        {!open && <span className="ai-fab-msg">{label} <span aria-hidden="true">👋</span></span>}
        <span className="ai-fab-ico">{open ? <Icon name="x" size={26} /> : <Robot size={46} small />}</span>
      </button>
    </div>
  );
}
