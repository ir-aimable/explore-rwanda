import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Field, Loader } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/Toast';
import { useLoad } from '../hooks/useLoad';
import { useI18n } from '../i18n';
import { ApiError, api } from '../services/api';

export function Notifications() {
  const { t, tx, lang } = useI18n(); const { refresh } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/notifications'), []);
  const text = (n: any) => {
    const d = { ...n.data };
    if (d.status) d.status = tx('ss.' + d.status);
    return tx('n.' + n.type, n.type, d);
  };
  return (<><div className="row spread"><h2>{t('dash.notifications')}</h2>
    <button className="btn btn-ghost btn-sm" onClick={async () => { await api.post('/notifications/read'); reload(); refresh(); }}>{t('c.mark_read')}</button></div>
    <Loader loading={loading} error={error} reload={reload}>
      {data?.items.length ? <div className="card">{data.items.map((n) => (
        <div key={n.id} className={`notif ${n.is_read ? '' : 'unread'}`}><div>{n.link ? <Link to={n.link}>{text(n)}</Link> : text(n)}</div>
          <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{new Date(n.created_at + 'Z').toLocaleDateString(lang === 'rw' ? 'en-GB' : 'en-GB')}</span></div>))}</div> : <Empty>{t('dash.no_notifications')}</Empty>}
    </Loader></>);
}

export function ProfileForm() {
  const { t } = useI18n(); const { user, refresh } = useAuth(); const toast = useToast();
  const [f, setF] = useState({ full_name: user?.full_name || '', phone: user?.phone || '', preferred_language: user?.preferred_language || 'rw' });
  const [pw, setPw] = useState({ current_password: '', new_password: '' }); const [err, setErr] = useState<Record<string, string>>({});
  const errs = (x: unknown) => (x instanceof ApiError && x.details ? x.details : {});
  async function save(e: React.FormEvent) { e.preventDefault(); setErr({}); try { await api.put('/auth/profile', { ...f, phone: f.phone || undefined }); await refresh(); toast.ok(t('dash.profile_saved')); } catch (x) { setErr(errs(x)); toast.fail(x); } }
  async function change(e: React.FormEvent) { e.preventDefault(); setErr({}); try { await api.put('/auth/password', pw); setPw({ current_password: '', new_password: '' }); toast.ok(t('dash.pw_changed')); } catch (x) { setErr(errs(x)); toast.fail(x); } }
  return (<div className="stack"><h2>{t('dash.profile')}</h2>
    <form className="form-grid two card card-pad" onSubmit={save}>
      <Field label={t('auth.full_name')} error={err.full_name}><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
      <Field label={t('c.email')}><input value={user?.email} readOnly /></Field>
      <Field label={t('c.phone')} error={err.phone}><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label={t('dash.language')}><select value={f.preferred_language} onChange={(e) => setF({ ...f, preferred_language: e.target.value as 'rw' | 'en' })}><option value="rw">Kinyarwanda</option><option value="en">English</option></select></Field>
      <div className="span2"><button className="btn">{t('c.save')}</button></div></form>
    <form className="form-grid two card card-pad" onSubmit={change}><h3 className="span2" style={{ margin: 0 }}>{t('dash.change_password')}</h3>
      <Field label={t('dash.current_password')} error={err.current_password}><input type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></Field>
      <Field label={t('dash.new_password')} error={err.new_password} hint={t('auth.pw_hint')}><input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></Field>
      <div className="span2"><button className="btn btn-ghost">{t('dash.change_password')}</button></div></form></div>);
}
