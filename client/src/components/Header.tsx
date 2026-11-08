import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../contexts/AuthContext';
import { useI18n, type Lang } from '../i18n';
import { Icon, Robot } from './Icon';
import { initials, Logo } from './ui';

export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <select className="lang-select" aria-label={t('nav.language')} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
      <option value="rw">Kinyarwanda</option>
      <option value="en">English</option>
    </select>
  );
}

export function Brand({ light }: { light?: boolean }) {
  const { t } = useI18n();
  return <Link to="/" className="brand" style={light ? { color: '#fff' } : undefined} aria-label={t('brand.name')}><Logo /><span>{t('brand.name')}</span></Link>;
}

export function Header() {
  const { t } = useI18n(); const { user, logout } = useAuth(); const nav = useNavigate(); const [open, setOpen] = useState(false);
  const links = [['/', t('nav.home')], ['/destinations', t('nav.destinations')], ['/trips', t('nav.trips')], ['/planner', t('nav.planner')], ['/about', t('nav.about')], ['/contact', t('nav.contact')]] as const;
  const out = async () => { await logout(); setOpen(false); nav('/'); };
  return (
    <header className="site-header">
      <div className="container header-in">
        <Brand />
        <nav className="nav" aria-label="Main">
          {links.map(([to, label]) => to === '/planner'
            ? <NavLink key={to} to={to} className="nav-ai" title={label} aria-label={label}><Robot size={24} small />{t('nav.planner_short')}</NavLink>
            : <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
          <span className="nav-tools">
            <LangSwitch />
            {user ? (<>
              <Link to={homeFor(user)} className="avatar" title={t('nav.dashboard')} aria-label={t('nav.dashboard')}>
                {initials(user.full_name)}
                {user.unread_notifications > 0 && <span className="badge-dot">{user.unread_notifications}</span>}
              </Link>
              <button className="btn btn-sm btn-ghost" onClick={out}>{t('nav.logout')}</button>
            </>) : (<>
              <Link to="/login" className="btn btn-sm btn-ghost">{t('nav.login')}</Link>
              <Link to="/register" className="btn btn-sm">{t('nav.register')}</Link>
            </>)}
          </span>
        </nav>
        <button className="menu-btn" aria-expanded={open} aria-label={t('nav.menu')} onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'menu'} size={20} /></button>
      </div>
      <nav className={`mobile-nav ${open ? 'open' : ''}`} aria-label="Mobile">
        {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>{label}</NavLink>)}
        {user ? (<>
          <Link to={homeFor(user)} onClick={() => setOpen(false)}>{t('nav.dashboard')}{user.unread_notifications > 0 && <span className="badge-dot">{user.unread_notifications}</span>}</Link>
          <button className="navlink" onClick={out}>{t('nav.logout')}</button>
        </>) : (<>
          <Link to="/login" onClick={() => setOpen(false)}>{t('nav.login')}</Link>
          <Link to="/register" onClick={() => setOpen(false)}>{t('nav.register')}</Link>
        </>)}
        <LangSwitch />
      </nav>
    </header>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div><Brand light /><p style={{ marginTop: 12 }}>{t('brand.tagline')}</p><p className="small">{t('footer.demo')}</p></div>
          <div><h4>{t('footer.explore')}</h4><ul><li><Link to="/destinations">{t('nav.destinations')}</Link></li><li><Link to="/trips">{t('nav.trips')}</Link></li><li><Link to="/planner">{t('nav.planner')}</Link></li></ul></div>
          <div><h4>{t('footer.platform')}</h4><ul><li><Link to="/about">{t('nav.about')}</Link></li><li><Link to="/contact">{t('nav.contact')}</Link></li><li><Link to="/become-organizer">{t('nav.organizer_apply')}</Link></li></ul></div>
        </div>
        <div className="copyright">© {new Date().getFullYear()} {t('footer.rights')}</div>
      </div>
    </footer>
  );
}

