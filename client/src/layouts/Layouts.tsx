import { Suspense, useEffect, useRef } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brand, Footer, Header, LangSwitch, ThemeSwitch } from '../components/Header';
import { Icon, type IconName } from '../components/Icon';
import { Avatar, Spinner } from '../components/ui';
import { homeFor, useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import type { Key } from '../i18n/en';

export function PublicLayout() {
  const { t } = useI18n();
  return (<><a className="skip" href="#main">{t('nav.skip')}</a><Header /><main id="main"><Suspense fallback={<Spinner />}><Outlet /></Suspense></main><Footer /></>);
}

export function RequireRole({ roles }: { roles: ('traveler' | 'organizer' | 'admin')[] }) {
  const { user, ready } = useAuth(); const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
export function RequireAuth() {
  const { user, ready } = useAuth(); const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Outlet />;
}

export interface DashLink { to: string; label: Key; end?: boolean; group?: Key; icon?: IconName }
export function DashLayout({ links, title }: { links: DashLink[]; title: string }) {
  const { t, tx } = useI18n(); const { user, logout } = useAuth(); const nav = useNavigate();
  const out = async () => { await logout(); nav('/'); };
  const mainRef = useRef<HTMLElement>(null); const loc = useLocation();
  // On phones, data tables render as stacked cards; each cell shows its column heading via data-label.
  useEffect(() => {
    const el = mainRef.current; if (!el) return;
    const label = () => el.querySelectorAll('table.t').forEach((tb) => {
      const heads = [...tb.querySelectorAll('thead th')].map((th) => th.textContent?.trim() || '');
      tb.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => {
        if (heads[i] && td.getAttribute('data-label') !== heads[i]) td.setAttribute('data-label', heads[i]);
      }));
    });
    label(); const mo = new MutationObserver(label); mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  // Keep the active section visible in the swipeable mobile menu.
  useEffect(() => { document.querySelector('.side-links a.active')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [loc.pathname]);
  return (
    <>
      <a className="skip" href="#main">{t('nav.skip')}</a>
      <div className="dash-shell">
        <aside className="side" aria-label={title}>
          <Brand light />
          <div className="side-title"><Avatar name={user?.full_name} /><span>{tx('role.' + (user?.role || ''), title)}</span></div>
          <nav className="side-links" aria-label={title}>
            {links.map((l, i) => (<span key={l.to} style={{ display: 'contents' }}>
              {l.group && (i === 0 || links[i - 1].group !== l.group) && <span className="group">{t(l.group)}</span>}
              <NavLink to={l.to} end={l.end}><Icon name={l.icon || 'list'} />{t(l.label)}</NavLink></span>))}
          </nav>
          <div className="side-foot">
            <Link to="/" style={{ color: 'inherit' }} className="side-home" title={t('nav.home')}><Icon name="globe" /> <span className="lbl">{t('nav.home')}</span></Link>
            <button onClick={out} title={t('nav.logout')}><Icon name="logout" /><span className="lbl">{t('nav.logout')}</span></button>
          </div>
        </aside>
        <div className="dash-col">
          <div className="dash-top">
            <span className="dash-brand"><Brand /></span>
            <ThemeSwitch />
            <LangSwitch />
            <Link to={user?.role === 'admin' ? '/admin/notifications' : user?.role === 'organizer' ? '/organizer/notifications' : '/traveler/notifications'} className="avatar" style={{ background: 'var(--paper)' }} aria-label={t('dash.notifications')}>
              <Icon name="bell" size={17} />{user && user.unread_notifications > 0 && <span className="badge-dot">{user.unread_notifications}</span>}
            </Link>
            <Avatar name={user?.full_name} />
          </div>
          <main id="main" className="dash-main" ref={mainRef}><section aria-label={title}><Suspense fallback={<Spinner />}><Outlet /></Suspense></section></main>
        </div>
      </div>
    </>
  );
}
