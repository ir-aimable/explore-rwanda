import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Footer, Header } from '../components/Header';
import { Spinner } from '../components/ui';
import { homeFor, useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import type { Key } from '../i18n/en';

export function PublicLayout() {
  const { t } = useI18n();
  return (<><a className="skip" href="#main">{t('nav.skip')}</a><Header /><main id="main"><Outlet /></main><Footer /></>);
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

export interface DashLink { to: string; label: Key; end?: boolean; group?: Key }
export function DashLayout({ links, title }: { links: DashLink[]; title: string }) {
  const { t } = useI18n();
  return (
    <>
      <a className="skip" href="#main">{t('nav.skip')}</a><Header />
      <main id="main" className="container">
        <div className="dash">
          <nav className="side" aria-label={title}>
            {links.map((l, i) => (<span key={l.to} style={{ display: 'contents' }}>
              {l.group && (i === 0 || links[i - 1].group !== l.group) && <span className="group">{t(l.group)}</span>}
              <NavLink to={l.to} end={l.end}>{t(l.label)}</NavLink></span>))}
          </nav>
          <section aria-label={title}><Outlet /></section>
        </div>
      </main>
    </>
  );
}
