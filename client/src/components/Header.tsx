import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
import { Logo } from './ui';

export function LangSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang" role="group" aria-label={t('nav.language')}>
      <button aria-pressed={lang === 'rw'} onClick={() => setLang('rw')} lang="rw">RW</button>
      <button aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
    </div>
  );
}

export function Header() {
  const { t } = useI18n(); const { user, logout } = useAuth(); const nav = useNavigate(); const [open, setOpen] = useState(false);
  const links = [['/', t('nav.home')], ['/destinations', t('nav.destinations')], ['/trips', t('nav.trips')], ['/planner', t('nav.planner')], ['/about', t('nav.about')], ['/contact', t('nav.contact')]] as const;
  const out = async () => { await logout(); setOpen(false); nav('/'); };
  const auth = (mobile: boolean) => user ? (<>
    <Link to={homeFor(user)} onClick={() => setOpen(false)} className={mobile ? '' : 'btn btn-sm'}>{t('nav.dashboard')}{user.unread_notifications > 0 && <span className="badge-dot">{user.unread_notifications}</span>}</Link>
    <button className={mobile ? 'navlink' : 'btn btn-sm btn-ghost'} onClick={out}>{t('nav.logout')}</button></>) : (<>
    <Link to="/login" onClick={() => setOpen(false)} className={mobile ? '' : 'btn btn-sm btn-ghost'}>{t('nav.login')}</Link>
    <Link to="/register" onClick={() => setOpen(false)} className={mobile ? '' : 'btn btn-sm'}>{t('nav.register')}</Link></>);
  return (
    <header className="site-header">
      <div className="container header-in">
        <Link to="/" className="brand" aria-label={t('brand.name')}><Logo /><span>{t('brand.name')}</span></Link>
        <nav className="nav" aria-label="Main">
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
          <span className="nav-tools"><LangSwitch />{auth(false)}</span>
        </nav>
        <button className="menu-btn" aria-expanded={open} aria-label={t('nav.menu')} onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
      </div>
      <nav className={`mobile-nav ${open ? 'open' : ''}`} aria-label="Mobile">
        {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>{label}</NavLink>)}
        {auth(true)}<LangSwitch />
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
          <div><div className="brand" style={{ color: '#fff' }}><Logo /><span>{t('brand.name')}</span></div><p style={{ marginTop: 10 }}>{t('brand.tagline')}</p><p className="small">{t('footer.demo')}</p></div>
          <div><h4>{t('footer.explore')}</h4><ul><li><Link to="/destinations">{t('nav.destinations')}</Link></li><li><Link to="/trips">{t('nav.trips')}</Link></li><li><Link to="/planner">{t('nav.planner')}</Link></li></ul></div>
          <div><h4>{t('footer.platform')}</h4><ul><li><Link to="/about">{t('nav.about')}</Link></li><li><Link to="/contact">{t('nav.contact')}</Link></li><li><Link to="/become-organizer">{t('nav.organizer_apply')}</Link></li></ul></div>
        </div>
        <div className="copyright">© {new Date().getFullYear()} {t('footer.rights')}</div>
      </div>
    </footer>
  );
}
