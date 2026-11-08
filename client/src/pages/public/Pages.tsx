import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Assistant } from '../../components/Assistant';
import { TripCard } from '../../components/Cards';
import { HeroImage } from '../../components/Cover';
import { Field, Loader } from '../../components/ui';
import { homeFor, useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/Toast';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { ApiError, api } from '../../services/api';
import type { Trip } from '../../types';

const fieldErrors = (e: unknown): Record<string, string> => (e instanceof ApiError && e.details ? e.details : {});

export function Planner() {
  const { t } = useI18n(); const [sp] = useSearchParams();
  return (<><div className="page-head"><div className="container"><h1>{t('ai.title')}</h1><p className="muted" style={{ margin: 0 }}>{t('ai.sub')}</p></div></div>
    <div className="container" style={{ paddingBottom: 40 }}><Assistant initial={sp.get('q') || undefined} /></div></>);
}

export function About() {
  const { t } = useI18n();
  return (<><div className="page-head"><div className="container"><h1>{t('about.title')}</h1></div></div>
    <div className="container section"><p>{t('about.p1')}</p><p>{t('about.p2')}</p><p className="notice">{t('about.p3')}</p><p style={{ marginTop: 24, fontFamily: 'var(--font-display)', fontSize: '1.3rem', maxWidth: '40ch' }}>{t('about.value')}</p></div></>);
}

export function Contact() {
  const { t, tx } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ name: user?.full_name || '', email: user?.email || '', subject: '', message: '' });
  const [err, setErr] = useState<Record<string, string>>({}); const [done, setDone] = useState(false);
  const mine = useLoad(() => (user ? api.get<{ items: any[] }>('/support/mine') : Promise.resolve({ items: [] })), [user?.id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr({});
    try { await api.post('/support', f); setDone(true); setF({ ...f, subject: '', message: '' }); toast.ok(t('contact.sent')); mine.reload(); } catch (x) { setErr(fieldErrors(x)); toast.fail(x); }
  }
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  return (<><div className="page-head"><div className="container"><h1>{t('contact.title')}</h1><p className="muted" style={{ margin: 0 }}>{t('contact.sub')}</p></div></div>
    <div className="container section-tight" style={{ maxWidth: 720 }}>
      {done && <div className="notice notice-green" style={{ marginBottom: 16 }}>{t('contact.sent')}</div>}
      <form className="form-grid two" onSubmit={submit}>
        <Field label={t('c.name')} error={err.name}><input value={f.name} onChange={set('name')} required /></Field>
        <Field label={t('c.email')} error={err.email}><input type="email" value={f.email} onChange={set('email')} required /></Field>
        <Field className="span2" label={t('c.subject')} error={err.subject}><input value={f.subject} onChange={set('subject')} required /></Field>
        <Field className="span2" label={t('c.message')} error={err.message}><textarea value={f.message} onChange={set('message')} required /></Field>
        <div className="span2"><button className="btn">{t('contact.send')}</button></div>
      </form>
      {mine.data && mine.data.items.length > 0 && <section style={{ marginTop: 32 }}><h3>{t('contact.mine')}</h3>{mine.data.items.map((s) => (
        <div key={s.id} className="card card-pad" style={{ marginBottom: 8 }}><strong>{s.subject}</strong> <span className="pill pill-grey">{tx('ss.' + s.status)}</span><p className="small" style={{ margin: '4px 0' }}>{s.message}</p>{s.admin_reply && <div className="notice small"><strong>{t('tr.admin_reply')}:</strong> {s.admin_reply}</div>}</div>))}</section>}
    </div></>);
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (<div className="auth-page">
    <div className="auth-art"><HeroImage src="/images/auth.jpg" slug="hiking" seed={11} /><div className="cap"><span className="t-script kicker">{t('poster.auth.top')}</span><h2 className="t-poster">{t('brand.name')}</h2><p style={{ color: '#e2ece4' }}>{t('brand.tagline')}</p></div></div>
    <div className="auth-wrap">{children}</div>
  </div>);
}

export function Login() {
  const { t, tx } = useI18n(); const { login } = useAuth(); const nav = useNavigate(); const [sp] = useSearchParams();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const u = await login(email, password); const next = sp.get('next'); nav(next && next.startsWith('/') ? next : homeFor(u)); }
    catch (x) { setErr(tx('err.' + (x instanceof ApiError ? (x.code === 'validation_error' ? 'invalid_credentials' : x.code) : 'generic'), t('err.generic'))); }
    setBusy(false);
  }
  return (<AuthFrame><h1 style={{ fontSize: '2rem' }}>{t('auth.login_title')}</h1><p className="muted">{t('auth.login_sub')}</p>
    <form className="stack" onSubmit={submit}>
      {err && <div className="notice notice-red" role="alert">{err}</div>}
      <Field label={t('c.email')}><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label={t('c.password')}><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
      <button className="btn btn-block" disabled={busy}>{t('auth.login_btn')}</button>
    </form>
    <p style={{ marginTop: 16 }}>{t('auth.no_account')} <Link to="/register">{t('nav.register')}</Link></p></AuthFrame>);
}

export function Register() {
  const { t } = useI18n(); const { register } = useAuth(); const nav = useNavigate(); const toast = useToast(); const { lang } = useI18n();
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '' }); const [err, setErr] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr({});
    try { await register({ ...f, phone: f.phone || undefined, preferred_language: lang }); nav('/traveler'); } catch (x) { setErr(fieldErrors(x)); if (!(x instanceof ApiError && x.code === 'validation_error')) toast.fail(x); }
    setBusy(false);
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (<AuthFrame><h1 style={{ fontSize: '2rem' }}>{t('auth.register_title')}</h1><p className="muted">{t('auth.register_sub')}</p>
    <form className="stack" onSubmit={submit}>
      <Field label={t('auth.full_name')} error={err.full_name}><input autoComplete="name" value={f.full_name} onChange={set('full_name')} required /></Field>
      <Field label={t('c.email')} error={err.email}><input type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></Field>
      <Field label={`${t('c.phone')} (${t('c.optional')})`} error={err.phone}><input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
      <Field label={t('c.password')} error={err.password} hint={t('auth.pw_hint')}><input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={8} /></Field>
      <button className="btn btn-block" disabled={busy}>{t('auth.register_btn')}</button>
    </form>
    <p style={{ marginTop: 16 }}>{t('auth.have_account')} <Link to="/login">{t('nav.login')}</Link></p></AuthFrame>);
}

export function BecomeOrganizer() {
  const { t, tx } = useI18n(); const { user, refresh } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ organizer_name: '', applicant_name: user?.full_name || '', email: user?.email || '', phone: user?.phone || '', experience: '', location: '', supporting_info: '', password: '' });
  const [err, setErr] = useState<Record<string, string>>({}); const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr({});
    try { await api.post('/organizer-applications', { ...f, password: user ? undefined : f.password, supporting_info: f.supporting_info || undefined }); setDone(true); toast.ok(t('app.sent')); refresh(); }
    catch (x) { setErr(fieldErrors(x)); toast.fail(x); }
  }
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const blocked = user && user.role !== 'traveler';
  return (<><div className="page-head"><div className="container"><h1>{t('app.title')}</h1><p className="muted" style={{ margin: 0 }}>{t('app.sub')}</p></div></div>
    <div className="container section-tight" style={{ maxWidth: 760 }}>
      {done ? <div className="notice notice-green">{t('app.sent')}</div> : blocked ? <div className="notice">{tx('role.' + user!.role)}</div> :
        user?.application?.status === 'pending' ? <div className="notice">{t('app.status_pending')}</div> : (<>
          {!user && <p className="notice">{t('app.login_hint')} <Link to="/login?next=/become-organizer">{t('nav.login')}</Link></p>}
          {user?.application?.status === 'rejected' && <p className="notice notice-red">{t('app.status_rejected')} {user.application.review_note}</p>}
          <form className="form-grid two" onSubmit={submit}>
            <Field label={t('app.org_name')} error={err.organizer_name}><input value={f.organizer_name} onChange={set('organizer_name')} required /></Field>
            <Field label={t('app.applicant')} error={err.applicant_name}><input value={f.applicant_name} onChange={set('applicant_name')} required /></Field>
            <Field label={t('c.email')} error={err.email}><input type="email" value={f.email} onChange={set('email')} required readOnly={!!user} /></Field>
            <Field label={t('c.phone')} error={err.phone}><input type="tel" value={f.phone} onChange={set('phone')} required /></Field>
            <Field label={t('app.location')} error={err.location}><input value={f.location} onChange={set('location')} required /></Field>
            {!user && <Field label={t('app.new_account')} error={err.password} hint={t('auth.pw_hint')}><input type="password" value={f.password} onChange={set('password')} required minLength={8} /></Field>}
            <Field className="span2" label={t('app.experience')} error={err.experience}><textarea value={f.experience} onChange={set('experience')} required minLength={20} /></Field>
            <Field className="span2" label={`${t('app.support')} (${t('c.optional')})`} error={err.supporting_info}><textarea value={f.supporting_info} onChange={set('supporting_info')} /></Field>
            <div className="span2"><button className="btn btn-gold">{t('app.submit')}</button></div>
          </form></>)}
    </div></>);
}

export function OrganizerProfile() {
  const { id } = useParams(); const { t } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api.get<any>(`/organizers/${id}`), [id]);
  return (<div className="container section-tight"><Loader loading={loading} error={error} reload={reload}>{data && (<>
    <h1>{data.organizer.display_name} <span className="pill">{t('c.verified')}</span></h1>
    <p className="muted">{data.organizer.location}</p>{data.organizer.bio && <p>{data.organizer.bio}</p>}
    {data.rating?.n > 0 && <p>★ {data.rating.avg} / 5 ({data.rating.n})</p>}
    <div className="small muted">{data.organizer.contact_email} {data.organizer.contact_phone}</div>
    <h2 style={{ marginTop: 28 }}>{t('nav.trips')}</h2><div className="grid grid-cards">{(data.trips as Trip[]).map((x) => <TripCard key={x.id} trip={x} />)}</div></>)}</Loader></div>);
}

export function NotFound() {
  const { t } = useI18n();
  return <div className="container section center"><h1>404</h1><p style={{ margin: '0 auto 16px' }}>{t('err.not_found')}</p><Link className="btn" to="/">{t('nav.home')}</Link></div>;
}
