import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Field, Loader, Modal, PasswordInput, Stars, useConfirm } from '../components/ui';
import { Cover } from '../components/Cover';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/Toast';
import { useLoad } from '../hooks/useLoad';
import { useI18n } from '../i18n';
import { ApiError, api } from '../services/api';
import type { Category, Destination, Experience } from '../types';

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
      <Field label={t('dash.current_password')} error={err.current_password}><PasswordInput autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></Field>
      <Field label={t('dash.new_password')} error={err.new_password} hint={t('auth.pw_hint')}><PasswordInput autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></Field>
      <div className="span2"><button className="btn btn-ghost">{t('dash.change_password')}</button></div></form></div>);
}

/** "Things to do" cards on the home page. Administrators see and edit every card; organizers only their own. */
export function ManageExperiences({ admin }: { admin?: boolean }) {
  const { t, lang, money } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: Experience[] }>('/experiences/manage'), []);
  const cats = useLoad(() => api.get<{ items: Category[] }>('/categories'), []);
  const dests = useLoad(() => api.get<{ items: Destination[] }>('/destinations?sort=name'), []);
  const blank = { id: 0, title_en: '', title_rw: '', location: '', price_from: '', duration: '', destination_id: '', category_id: '', sort_order: 0, initial_rating: '', is_published: true };
  const [f, setF] = useState<any>(null); const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState<Record<string, string>>({});
  const errs = (x: unknown) => (x instanceof ApiError && x.details ? x.details : {});
  const edit = (e: Experience) => { setFile(null); setErr({}); setF({ id: e.id, title_en: e.title_en, title_rw: e.title_rw, location: e.location, price_from: e.price_from, duration: e.duration ?? '',
    destination_id: e.destination?.id ?? '', category_id: e.category?.id ?? '', sort_order: e.sort_order, initial_rating: e.initial_rating ?? '', is_published: e.is_published, image_path: e.image_path }); };
  async function save(ev: React.FormEvent) {
    ev.preventDefault(); setErr({});
    const body = { title_en: f.title_en, title_rw: f.title_rw, location: f.location, price_from: Number(f.price_from), duration: f.duration || null,
      destination_id: f.destination_id || null, category_id: f.category_id || null, sort_order: Number(f.sort_order) || 0, initial_rating: f.initial_rating ? Number(f.initial_rating) : null, is_published: f.is_published };
    try {
      let id = f.id;
      if (id) await api.put(`/experiences/${id}`, body); else id = (await api.post<{ id: number }>('/experiences', body)).id;
      if (file) await api.upload(`/experiences/${id}/image`, file);
      setF(null); setFile(null); reload(); toast.ok(t('c.saved'));
    } catch (x) { setErr(errs(x)); toast.fail(x); }
  }
  const del = (e: Experience) => ask(t('c.confirm_delete'), async () => { try { await api.del(`/experiences/${e.id}`); reload(); toast.ok(t('c.saved')); } catch (x) { toast.fail(x); } });
  const set = (k: string) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: ev.target.value });
  return (<div className="stack">
    <div className="row spread"><div><h2 style={{ margin: 0 }}>{t('exp.manage')}</h2><p className="small muted" style={{ margin: '4px 0 0' }}>{admin ? t('exp.manage_sub_admin') : t('exp.manage_sub_org')}</p></div>
      <button className="btn" onClick={() => { setFile(null); setErr({}); setF({ ...blank }); }}><Icon name="plus" size={16} />{t('exp.new')}</button></div>
    <Loader loading={loading} error={error} reload={reload}>{data?.items.length ? <div className="table-wrap"><table className="t"><thead><tr>
      <th>{t('exp.title_col')}</th><th>{t('exp.rating')}</th><th>{t('exp.price_from')}</th>{admin && <th>{t('exp.owner')}</th>}<th>{t('c.published')}</th><th>{t('c.actions')}</th></tr></thead><tbody>
      {data.items.map((e) => (<tr key={e.id}>
        <td><div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><Cover className="exp-thumb" src={e.image_path} slug={e.category?.slug || 'nature'} seed={e.id + 7} />
          <div><strong>{lang === 'rw' ? e.title_rw : e.title_en}</strong> {e.is_demo && <span className="pill pill-grey">{t('c.demo')}</span>}
            <div className="small muted">{e.location}{e.duration ? ` · ${e.duration}` : ''}{e.category ? ` · ${lang === 'rw' ? e.category.name_rw : e.category.name_en}` : ''}</div></div></div></td>
        <td style={{ whiteSpace: 'nowrap' }}>{e.avg_rating != null && <><Stars n={e.avg_rating} /> {e.avg_rating.toFixed(1)} <span className="small muted">({e.rating_count})</span></>}
          <div className="small muted">{t('exp.recommended_n', { n: e.recommendations })} · {t('dest.open_trips', { n: e.open_trips })}</div></td>
        <td style={{ whiteSpace: 'nowrap' }}>{money(e.price_from)}</td>
        {admin && <td>{e.organizer?.display_name || t('exp.platform')}</td>}
        <td>{e.is_published ? t('c.yes') : t('c.no')}</td>
        <td><div className="actions"><button className="btn btn-ghost btn-sm" onClick={() => edit(e)}>{t('c.edit')}</button><button className="btn btn-danger btn-sm" onClick={() => del(e)}>{t('c.delete')}</button></div></td>
      </tr>))}</tbody></table></div> : <Empty>{t('exp.none')}</Empty>}</Loader>
    {!admin && <RecommendExperiences />}
    {f && <Modal wide title={f.id ? t('c.edit') : t('exp.new')} onClose={() => setF(null)}><form className="form-grid two" onSubmit={save}>
      <Field label={t('exp.title_en')} error={err.title_en}><input value={f.title_en} onChange={set('title_en')} placeholder="Milking cows in Bigogwe" required maxLength={120} /></Field>
      <Field label={t('exp.title_rw')} error={err.title_rw}><input value={f.title_rw} onChange={set('title_rw')} placeholder="Gukama inka i Bigogwe" required maxLength={120} /></Field>
      <Field label={t('exp.location')} error={err.location}><input value={f.location} onChange={set('location')} placeholder="Bigogwe" required maxLength={80} /></Field>
      <Field label={t('exp.price_from') + ' (RWF)'} error={err.price_from}><input type="number" min={0} step={500} value={f.price_from} onChange={set('price_from')} required /></Field>
      <Field label={t('exp.duration')} error={err.duration} hint={t('c.optional')}><input value={f.duration} onChange={set('duration')} placeholder={t('exp.duration_ph')} maxLength={40} /></Field>
      <Field label={t('trips.activity')} error={err.category_id}><select value={f.category_id} onChange={set('category_id')}><option value="">—</option>{cats.data?.items.map((c) => <option key={c.id} value={c.id}>{lang === 'rw' ? c.name_rw : c.name_en}</option>)}</select></Field>
      <Field label={t('exp.destination')} error={err.destination_id && t('exp.destination_required')} hint={t('exp.destination_hint')}><select value={f.destination_id} onChange={set('destination_id')} required><option value="">{t('exp.pick_destination')}</option>{dests.data?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
      <Field label={t('exp.initial_rating')} error={err.initial_rating} hint={t('exp.initial_rating_hint')}><select value={f.initial_rating} onChange={set('initial_rating')}>
        <option value="">{t('exp.no_initial_rating')}</option>
        {[3, 4, 5].map((r) => <option key={r} value={r}>{'★'.repeat(r)} {t(`exp.rate_${r}` as any)}</option>)}</select></Field>
      <Field label={t('exp.order')} error={err.sort_order} hint={t('exp.order_hint')}><input type="number" min={0} max={999} value={f.sort_order} onChange={set('sort_order')} /></Field>
      <Field className="span2" label={t('exp.photo')} hint={t('exp.photo_hint')}>
        <div className="row">{(file || f.image_path) && <img src={file ? URL.createObjectURL(file) : f.image_path} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8 }} />}
          <label className="btn btn-ghost btn-sm">{t('ad.upload_image')}<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(ev) => setFile(ev.target.files?.[0] || null)} /></label></div>
      </Field>
      <label className="check span2"><input type="checkbox" checked={f.is_published} onChange={(ev) => setF({ ...f, is_published: ev.target.checked })} />{t('c.published')}</label>
      <div className="span2 row"><button type="button" className="btn btn-ghost" onClick={() => setF(null)}>{t('c.cancel')}</button><button className="btn">{t('c.save')}</button></div>
    </form></Modal>}
    {dialog}</div>);
}

/** Organizers vouch for other organizers' (and the platform's) "Things to do" cards. Recommended cards rank higher on the home page. */
function RecommendExperiences() {
  const { t, lang } = useI18n(); const toast = useToast(); const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: Experience[] }>('/experiences'), []);
  const [busy, setBusy] = useState(0);
  const mine = user?.organizer?.id;
  const items = (data?.items || []).filter((e) => e.organizer?.id !== mine);
  async function toggle(e: Experience) {
    setBusy(e.id);
    try { if (e.recommended_by_me) await api.del(`/experiences/${e.id}/recommend`); else await api.post(`/experiences/${e.id}/recommend`); reload(); } catch (x) { toast.fail(x); }
    setBusy(0);
  }
  return (<div className="stack" style={{ marginTop: 18 }}>
    <div><h3 style={{ margin: 0 }}>{t('exp.recommend_title')}</h3><p className="small muted" style={{ margin: '4px 0 0' }}>{t('exp.recommend_sub')}</p></div>
    <Loader loading={loading} error={error} reload={reload}>{items.length ? <div className="table-wrap"><table className="t"><tbody>
      {items.map((e) => (<tr key={e.id}>
        <td><strong>{lang === 'rw' ? e.title_rw : e.title_en}</strong><div className="small muted">{e.location} · {e.organizer?.display_name || t('exp.platform')}</div></td>
        <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{t('exp.recommended_n', { n: e.recommendations })}</td>
        <td style={{ textAlign: 'right' }}><button className={`btn btn-sm ${e.recommended_by_me ? 'btn-ghost' : ''}`} disabled={busy === e.id} aria-pressed={e.recommended_by_me} onClick={() => toggle(e)}>
          <Icon name={e.recommended_by_me ? 'check' : 'checkCircle'} size={14} />{e.recommended_by_me ? t('exp.recommended') : t('exp.recommend')}</button></td>
      </tr>))}</tbody></table></div> : <Empty>{t('exp.none')}</Empty>}</Loader>
  </div>);
}
