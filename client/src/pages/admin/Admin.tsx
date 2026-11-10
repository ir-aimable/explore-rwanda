import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Donut, Empty, Field, Kpi, Loader, Modal, Status, useConfirm } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useToast } from '../../contexts/Toast';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { ApiError, api } from '../../services/api';

const useAct = (reload: () => void) => { const toast = useToast(); return (fn: () => Promise<unknown>, ok?: string) => async () => { try { await fn(); if (ok) toast.ok(ok); reload(); } catch (e) { toast.fail(e); } }; };
const errs = (x: unknown) => (x instanceof ApiError && x.details ? x.details : {});

export function AdminHome() {
  const { t, tx, fmtDate } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api.get<any>('/admin/stats'), []);
  const S = data?.stats;
  const more: [string, number, boolean?][] = S ? [['ad.stat.approved_orgs', S.approved_organizers], ['ad.stat.suspended_orgs', S.suspended_organizers], ['ad.stat.published', S.trips_published],
    ['ad.stat.regs', S.registrations_total], ['ad.stat.pending_regs', S.registrations_pending, S.registrations_pending > 0], ['ad.stat.admins', S.admins], ['ad.stat.support', S.open_support, S.open_support > 0], ['ad.stat.reports', S.open_reports, S.open_reports > 0]] : [];
  return (<div className="stack">
    <div className="dash-head"><div><h1>{tx('role.admin', 'Admin')} · {t('dash.overview')}</h1><p>{t('ad.overview_sub')}</p></div>
      <div className="row"><Link className="btn btn-sm" to="/admin/applications">{t('ad.applications')}</Link><Link className="btn btn-ghost btn-sm" to="/admin/trips/new">{t('org.create_trip')}</Link></div></div>
    <Loader loading={loading} error={error} reload={reload}>{S && (<div className="stack">
      <div className="kpis">
        <Kpi icon="users" value={S.users_total} label={t('ad.stat.users')} />
        <Kpi icon="user" value={S.travelers} label={t('ad.stat.travelers')} />
        <Kpi icon="shield" value={S.organizers} label={t('ad.stat.organizers')} />
        <Kpi icon="flag" tone="gold" value={S.pending_applications} label={t('ad.stat.pending_apps')} />
      </div>
      <div className="dash-cols">
        <div className="card card-pad"><div className="panel-head"><h3>{t('ad.recent_regs')}</h3><Link className="see-all small" to="/admin/registrations">{t('dash.view_all')} <Icon name="arrowRight" size={14} /></Link></div>
          {data.recent_registrations.length ? data.recent_registrations.map((r: any) => <div key={r.id} className="list-row"><Avatar name={r.full_name} /><div className="grow"><strong>{r.full_name}</strong><span className="small muted">{r.title} · {fmtDate(r.created_at.slice(0, 10))}</span></div><Status kind="rs" value={r.status} /></div>) : <Empty>{t('c.none')}</Empty>}
        </div>
        <div className="card card-pad"><div className="panel-head"><h3>{t('ad.trip_status')}</h3><Link className="see-all small" to="/admin/trips">{t('dash.view_all')} <Icon name="arrowRight" size={14} /></Link></div>
          <Donut label={t('ad.trips')} data={[{ label: t('ad.stat.upcoming'), value: S.trips_upcoming, color: '#1e6b3a' }, { label: t('ad.stat.completed'), value: S.trips_completed, color: '#e0a800' }, { label: t('ad.stat.cancelled'), value: S.trips_cancelled, color: '#c0392b' }]} />
        </div>
      </div>
      <div className="kpis">{more.map(([k, v, w]) => <div key={k} className={`stat ${w ? 'warn' : ''}`}><b>{v}</b><span>{t(k as any)}</span></div>)}</div>
      <div className="card card-pad"><div className="panel-head"><h3>{t('ad.recent_activity')}</h3><Link className="see-all small" to="/admin/audit">{t('dash.view_all')} <Icon name="arrowRight" size={14} /></Link></div>
        {data.recent_audit.map((a: any) => <div key={a.id} className="list-row small"><Icon name="history" size={16} /><div className="grow"><code>{a.action}</code> · {a.actor_email}</div><span className="muted">{fmtDate(a.created_at.slice(0, 10))}</span></div>)}</div>
    </div>)}<span className="sr-only">{tx('c.done')}</span></Loader></div>);
}

export function Users() {
  const { t, tx, fmtDate } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [show, setShow] = useState(false);
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>(`/admin/users?q=${encodeURIComponent(q)}&role=${role}`), [q, role]);
  const act = useAct(reload);
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '', role: 'traveler' }); const [err, setErr] = useState<Record<string, string>>({});
  async function create(e: React.FormEvent) { e.preventDefault(); setErr({}); try { await api.post('/admin/users', { ...f, phone: f.phone || undefined }); setShow(false); setF({ full_name: '', email: '', phone: '', password: '', role: 'traveler' }); reload(); toast.ok(t('c.saved')); } catch (x) { setErr(errs(x)); toast.fail(x); } }
  return (<><div className="row spread"><h2>{t('ad.users')}</h2><button className="btn" onClick={() => setShow(true)}>{t('ad.add_user')}</button></div>
    <div className="row" style={{ marginBottom: 12 }}><input style={{ maxWidth: 260 }} placeholder={t('c.search_ph')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('c.search')} />
      <select style={{ width: 'auto' }} value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('c.role')}><option value="">{t('c.all')}</option>{['traveler', 'organizer', 'admin'].map((r) => <option key={r} value={r}>{tx('role.' + r)}</option>)}</select></div>
    <Loader loading={loading} error={error} reload={reload}><div className="table-wrap"><table className="t"><thead><tr><th>{t('c.name')}</th><th>{t('c.role')}</th><th>{t('c.status')}</th><th>{t('c.created')}</th><th>{t('c.actions')}</th></tr></thead><tbody>
      {data?.items.map((u) => (<tr key={u.id}><td>{u.full_name} {u.is_demo ? <span className="pill pill-grey">{t('c.demo')}</span> : null}<div className="small muted">{u.email} {u.phone}</div></td><td><Status kind="role" value={u.role} /></td>
        <td>{u.is_active ? <span className="pill">{t('c.is_active')}</span> : <span className="pill pill-red">{t('ad.deactivate')}</span>}</td><td>{fmtDate(u.created_at.slice(0, 10))}</td>
        <td><div className="actions">
          {u.is_active ? <button className="btn btn-ghost btn-sm" onClick={() => ask(t('ad.confirm_deactivate'), act(() => api.patch(`/admin/users/${u.id}/active`, { is_active: false })))}>{t('ad.deactivate')}</button> : <button className="btn btn-sm" onClick={act(() => api.patch(`/admin/users/${u.id}/active`, { is_active: true }))}>{t('ad.activate')}</button>}
          {u.role === 'traveler' && <button className="btn btn-ghost btn-sm" onClick={() => ask(t('ad.confirm_admin'), act(() => api.patch(`/admin/users/${u.id}/role`, { role: 'admin' })), false)}>{t('ad.make_admin')}</button>}
          {u.role === 'admin' && <button className="btn btn-ghost btn-sm" onClick={() => ask(t('ad.confirm_admin'), act(() => api.patch(`/admin/users/${u.id}/role`, { role: 'traveler' })), false)}>{t('ad.revoke_admin')}</button>}
          <button className="btn btn-danger btn-sm" onClick={() => ask(t('ad.confirm_delete_user'), act(() => api.del(`/admin/users/${u.id}`)))}>{t('c.delete')}</button></div></td></tr>))}</tbody></table></div>
      <p className="small muted">{t('ad.retention')}</p></Loader>
    {show && <Modal title={t('ad.add_user')} onClose={() => setShow(false)}><form className="stack" onSubmit={create}>
      <Field label={t('auth.full_name')} error={err.full_name}><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
      <Field label={t('c.email')} error={err.email}><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
      <Field label={t('c.phone')} error={err.phone}><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label={t('c.password')} error={err.password} hint={t('auth.pw_hint')}><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
      <Field label={t('c.role')}><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="traveler">{tx('role.traveler')}</option><option value="admin">{tx('role.admin')}</option></select></Field>
      <div className="row"><button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>{t('c.cancel')}</button><button className="btn">{t('c.create')}</button></div></form></Modal>}
    {dialog}</>);
}

export function Applications() {
  const { t, tx, fmtDate } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm(); const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>(`/admin/applications${status ? '?status=' + status : ''}`), [status]);
  const [rej, setRej] = useState<any>(null); const [note, setNote] = useState('');
  const act = useAct(reload);
  return (<><h2>{t('ad.applications')}</h2>
    <div className="tabs" role="tablist">{['', 'pending', 'approved', 'rejected'].map((s) => <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}>{s ? tx('as.' + s) : t('c.all')}</button>)}</div>
    <Loader loading={loading} error={error} reload={reload}>{data?.items.length ? data.items.map((a) => (
      <div key={a.id} className="card card-pad" style={{ marginBottom: 10 }}><div className="row spread"><h3 style={{ margin: 0 }}>{a.organizer_name}</h3><Status kind="as" value={a.status} /></div>
        <p className="small muted" style={{ margin: '4px 0' }}>{a.applicant_name} · {a.email} · {a.phone} · {a.location} · {fmtDate(a.created_at.slice(0, 10))} {a.is_demo ? `· ${t('c.demo')}` : ''}</p>
        <p style={{ margin: '6px 0' }}>{a.experience}</p>{a.supporting_info && <p className="small">{a.supporting_info}</p>}{a.review_note && <p className="small muted">{t('c.note')}: {a.review_note}</p>}
        {a.status === 'pending' && <div className="row"><button className="btn" onClick={act(() => api.post(`/admin/applications/${a.id}/approve`), t('c.done'))}>{t('c.approve')}</button><button className="btn btn-ghost" onClick={() => { setRej(a); setNote(''); }}>{t('c.reject')}</button></div>}</div>)) : <Empty>{t('c.none')}</Empty>}</Loader>
    {rej && <Modal title={`${t('ad.confirm_reject')} ${rej.organizer_name}`} onClose={() => setRej(null)}><Field label={t('ad.review_note')}><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="row" style={{ marginTop: 12 }}><button className="btn btn-ghost" onClick={() => setRej(null)}>{t('c.cancel')}</button><button className="btn btn-danger" onClick={async () => { const id = rej.id; setRej(null); await act(() => api.post(`/admin/applications/${id}/reject`, { note }))(); }}>{t('c.reject')}</button></div></Modal>}
    {dialog}</>);
}

export function Organizers() {
  const { t, tx } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm(); const [show, setShow] = useState(false);
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/admin/organizers'), []); const act = useAct(reload);
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '', display_name: '' }); const [err, setErr] = useState<Record<string, string>>({});
  async function create(e: React.FormEvent) { e.preventDefault(); setErr({}); try { await api.post('/admin/organizers', { ...f, phone: f.phone || undefined, role: 'traveler' }); setShow(false); reload(); toast.ok(t('c.saved')); } catch (x) { setErr(errs(x)); toast.fail(x); } }
  return (<><div className="row spread"><h2>{t('ad.organizers')}</h2><button className="btn" onClick={() => setShow(true)}>{t('ad.add_organizer')}</button></div>
    <Loader loading={loading} error={error} reload={reload}><div className="table-wrap"><table className="t"><thead><tr><th>{t('c.organizer')}</th><th>{t('c.location')}</th><th>{t('nav.trips')}</th><th>{t('c.status')}</th><th>{t('c.actions')}</th></tr></thead><tbody>
      {data?.items.map((o) => (<tr key={o.id}><td><strong>{o.display_name}</strong><div className="small muted">{o.full_name} · {o.email}</div></td><td>{o.location}</td><td>{o.trips}</td><td><Status kind="as" value={o.status === 'approved' && o.role !== 'organizer' ? 'suspended' : o.status} /></td>
        <td><div className="actions">{o.status === 'approved' && o.role === 'organizer' ? <button className="btn btn-ghost btn-sm" onClick={() => ask(t('ad.confirm_suspend'), act(() => api.patch(`/admin/organizers/${o.id}/status`, { status: 'suspended' })))}>{t('ad.suspend')}</button> : <button className="btn btn-sm" onClick={act(() => api.patch(`/admin/organizers/${o.id}/status`, { status: 'approved' }))}>{t('ad.reactivate')}</button>}
          {o.role === 'organizer' && <button className="btn btn-danger btn-sm" onClick={() => ask(t('ad.confirm_revoke'), act(() => api.del(`/admin/organizers/${o.id}`)))}>{t('ad.revoke')}</button>}</div></td></tr>))}</tbody></table></div></Loader>
    {show && <Modal title={t('ad.add_organizer')} onClose={() => setShow(false)}><form className="stack" onSubmit={create}>
      <Field label={t('org.display_name')} error={err.display_name}><input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} required /></Field>
      <Field label={t('auth.full_name')} error={err.full_name}><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></Field>
      <Field label={t('c.email')} error={err.email}><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
      <Field label={t('c.phone')} error={err.phone}><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label={t('c.password')} error={err.password} hint={t('auth.pw_hint')}><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
      <div className="row"><button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>{t('c.cancel')}</button><button className="btn">{t('c.create')}</button></div></form></Modal>}
    {dialog}</>);
}

export function AdminDestinations() {
  const { t, lang } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/admin/destinations'), []);
  const cats = useLoad(() => api.get<{ items: any[] }>('/categories'), []); const act = useAct(reload);
  const blank = { id: 0, name: '', region: '', description_rw: '', description_en: '', latitude: '', longitude: '', is_published: true, category_ids: [] as number[] };
  const [f, setF] = useState<any>(null); const [err, setErr] = useState<Record<string, string>>({});
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr({});
    const body = { name: f.name, region: f.region, description_rw: f.description_rw, description_en: f.description_en, latitude: f.latitude === '' || f.latitude == null ? null : Number(f.latitude), longitude: f.longitude === '' || f.longitude == null ? null : Number(f.longitude), is_published: !!f.is_published, category_ids: f.category_ids };
    try { if (f.id) await api.put(`/admin/destinations/${f.id}`, body); else await api.post('/admin/destinations', body); setF(null); reload(); toast.ok(t('c.saved')); } catch (x) { setErr(errs(x)); toast.fail(x); }
  }
  const up = async (id: number, file?: File) => { if (!file) return; try { await api.upload(`/admin/destinations/${id}/image`, file); reload(); toast.ok(t('c.saved')); } catch (x) { toast.fail(x); } };
  return (<><div className="row spread"><h2>{t('ad.destinations')}</h2><button className="btn" onClick={() => setF({ ...blank })}>{t('ad.new_destination')}</button></div>
    <Loader loading={loading} error={error} reload={reload}><div className="table-wrap"><table className="t"><thead><tr><th>{t('c.name')}</th><th>{t('ad.region')}</th><th>{t('c.published')}</th><th>{t('c.actions')}</th></tr></thead><tbody>
      {data?.items.map((d) => (<tr key={d.id}><td><strong>{d.name}</strong> {d.is_demo ? <span className="pill pill-grey">{t('c.demo')}</span> : null}{d.image_path && <div><img src={d.image_path} alt="" style={{ width: 80, borderRadius: 3, marginTop: 4 }} /></div>}</td><td>{d.region}</td><td>{d.is_published ? t('c.yes') : t('c.no')}</td>
        <td><div className="actions"><button className="btn btn-ghost btn-sm" onClick={() => setF({ ...d, latitude: d.latitude ?? '', longitude: d.longitude ?? '', is_published: !!d.is_published })}>{t('c.edit')}</button>
          <label className="btn btn-ghost btn-sm">{t('ad.upload_image')}<input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => up(d.id, e.target.files?.[0])} /></label>
          <button className="btn btn-danger btn-sm" onClick={() => ask(t('c.confirm_delete'), act(() => api.del(`/admin/destinations/${d.id}`)))}>{t('c.delete')}</button></div></td></tr>))}</tbody></table></div></Loader>
    {f && <Modal wide title={f.id ? t('c.edit') : t('ad.new_destination')} onClose={() => setF(null)}><form className="form-grid two" onSubmit={save}>
      <Field label={t('c.name')} error={err.name}><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field><Field label={t('ad.region')} error={err.region}><input value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} required /></Field>
      <Field className="span2" label={t('ad.desc_rw')} error={err.description_rw}><textarea value={f.description_rw} onChange={(e) => setF({ ...f, description_rw: e.target.value })} required /></Field>
      <Field className="span2" label={t('ad.desc_en')} error={err.description_en}><textarea value={f.description_en} onChange={(e) => setF({ ...f, description_en: e.target.value })} required /></Field>
      <Field label={t('form.lat')}><input type="number" step="any" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} /></Field><Field label={t('form.lng')}><input type="number" step="any" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} /></Field>
      <div className="span2"><span className="label">{t('dest.activities')}</span><div className="row">{cats.data?.items.map((c) => <label key={c.id} className="check"><input type="checkbox" checked={f.category_ids.includes(c.id)} onChange={(e) => setF({ ...f, category_ids: e.target.checked ? [...f.category_ids, c.id] : f.category_ids.filter((x: number) => x !== c.id) })} />{lang === 'rw' ? c.name_rw : c.name_en}</label>)}</div></div>
      <label className="check span2"><input type="checkbox" checked={f.is_published} onChange={(e) => setF({ ...f, is_published: e.target.checked })} />{t('c.published')}</label>
      <div className="span2 row"><button type="button" className="btn btn-ghost" onClick={() => setF(null)}>{t('c.cancel')}</button><button className="btn">{t('c.save')}</button></div></form></Modal>}
    {dialog}</>);
}

export function ReviewsReports() {
  const { t, tx, fmtDate } = useI18n(); const { ask, dialog } = useConfirm();
  const rv = useLoad(() => api.get<{ items: any[] }>('/admin/reviews'), []); const rp = useLoad(() => api.get<{ items: any[] }>('/admin/reports'), []);
  const a1 = useAct(rv.reload); const a2 = useAct(rp.reload);
  return (<div className="stack"><h2>{t('ad.reviews')}</h2>
    <Loader loading={rv.loading} error={rv.error} reload={rv.reload}>{rv.data?.items.length ? <div className="table-wrap"><table className="t"><thead><tr><th>{t('ad.reviewer')}</th><th>{t('c.rating')}</th><th>{t('c.comment')}</th><th>{t('c.status')}</th><th /></tr></thead><tbody>
      {rv.data.items.map((r) => (<tr key={r.id}><td>{r.reviewer}<div className="small muted">{r.title} · {fmtDate(r.created_at.slice(0, 10))}</div></td><td>{'★'.repeat(r.rating)}</td><td>{r.comment}</td><td><span className={`pill ${r.status === 'hidden' ? 'pill-grey' : ''}`}>{r.status}</span></td>
        <td><div className="actions"><button className="btn btn-ghost btn-sm" onClick={a1(() => api.patch(`/admin/reviews/${r.id}`, { status: r.status === 'hidden' ? 'visible' : 'hidden' }))}>{r.status === 'hidden' ? t('ad.show') : t('ad.hide')}</button>
          <button className="btn btn-danger btn-sm" onClick={() => ask(t('c.confirm_delete'), a1(() => api.del(`/admin/reviews/${r.id}`)))}>{t('c.delete')}</button></div></td></tr>))}</tbody></table></div> : <Empty>{t('trip.no_reviews')}</Empty>}</Loader>
    <h3>{t('ad.reports')}</h3><Loader loading={rp.loading} error={rp.error} reload={rp.reload}>{rp.data?.items.length ? <div className="table-wrap"><table className="t"><tbody>{rp.data.items.map((r) => (
      <tr key={r.id}><td>{r.reporter}<div className="small muted">{r.target_type} #{r.target_id}</div></td><td>{r.reason}</td><td><span className="pill pill-grey">{r.status}</span></td>
        <td>{r.status === 'open' && <div className="actions"><button className="btn btn-sm" onClick={a2(() => api.patch(`/admin/reports/${r.id}`, { status: 'resolved' }))}>{t('ad.resolve')}</button><button className="btn btn-ghost btn-sm" onClick={a2(() => api.patch(`/admin/reports/${r.id}`, { status: 'dismissed' }))}>{t('ad.dismiss')}</button></div>}</td></tr>))}</tbody></table></div> : <Empty>{t('c.none')}</Empty>}</Loader>
    <span className="sr-only">{tx('c.done')}</span>{dialog}</div>);
}

export function AdminSupport() {
  const { t, tx, fmtDate } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/admin/support'), []);
  const [open, setOpen] = useState<any>(null); const [reply, setReply] = useState(''); const [st, setSt] = useState('resolved');
  async function send(e: React.FormEvent) { e.preventDefault(); try { await api.patch(`/admin/support/${open.id}`, { status: st, admin_reply: reply }); setOpen(null); reload(); toast.ok(t('c.saved')); } catch (x) { toast.fail(x); } }
  return (<><h2>{t('ad.support')}</h2><Loader loading={loading} error={error} reload={reload}>{data?.items.length ? data.items.map((s) => (
    <div key={s.id} className="card card-pad" style={{ marginBottom: 8 }}><div className="row spread"><strong>{s.subject}</strong><span className="pill pill-grey">{tx('ss.' + s.status)}</span></div>
      <p className="small muted" style={{ margin: '2px 0' }}>{s.name} · {s.email} · {fmtDate(s.created_at.slice(0, 10))}</p><p style={{ margin: '4px 0' }}>{s.message}</p>{s.admin_reply && <div className="notice small">{s.admin_reply}</div>}
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setOpen(s); setReply(s.admin_reply || ''); setSt(s.status === 'open' ? 'resolved' : s.status); }}>{t('c.reply')}</button></div>)) : <Empty>{t('c.none')}</Empty>}</Loader>
    {open && <Modal title={open.subject} onClose={() => setOpen(null)}><form className="stack" onSubmit={send}><Field label={t('c.reply')}><textarea value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
      <Field label={t('ad.reply_status')}><select value={st} onChange={(e) => setSt(e.target.value)}>{['open', 'in_progress', 'resolved'].map((s) => <option key={s} value={s}>{tx('ss.' + s)}</option>)}</select></Field>
      <div className="row"><button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>{t('c.cancel')}</button><button className="btn">{t('c.save')}</button></div></form></Modal>}</>);
}

export function AuditLog() {
  const { t, fmtDate } = useI18n(); const [page, setPage] = useState(1); const [action, setAction] = useState('');
  const { data, loading, error, reload } = useLoad(() => api.get<any>(`/admin/audit?page=${page}&action=${encodeURIComponent(action)}`), [page, action]);
  return (<><h2>{t('ad.audit')}</h2><div className="row" style={{ marginBottom: 12 }}><input style={{ maxWidth: 260 }} placeholder={t('ad.filter_action')} value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} /></div>
    <Loader loading={loading} error={error} reload={reload}><div className="table-wrap"><table className="t"><thead><tr><th>{t('c.date')}</th><th>{t('ad.actor')}</th><th>{t('ad.action')}</th><th>{t('ad.target')}</th></tr></thead><tbody>
      {data?.items.map((a: any) => (<tr key={a.id}><td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.created_at.slice(0, 10))} {a.created_at.slice(11, 16)}</td><td>{a.actor_email}</td><td><code>{a.action}</code></td><td>{a.entity} {a.entity_id}<div className="small muted">{a.details}</div></td></tr>))}</tbody></table></div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('c.prev')}</button><span className="small">{t('c.page')} {data?.page} / {Math.max(1, data?.pages ?? 1)}</span><button className="btn btn-ghost btn-sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(page + 1)}>{t('c.next')}</button></div></Loader></>);
}

export function Categories() {
  const { t, lang } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/admin/categories'), []); const act = useAct(reload);
  const [f, setF] = useState({ slug: '', name_rw: '', name_en: '' });
  async function add(e: React.FormEvent) { e.preventDefault(); try { await api.post('/admin/categories', { ...f, is_active: true }); setF({ slug: '', name_rw: '', name_en: '' }); reload(); } catch (x) { toast.fail(x); } }
  return (<><h2>{t('ad.categories')}</h2><form className="row card card-pad" onSubmit={add} style={{ marginBottom: 14 }}>
    <input style={{ width: 130 }} placeholder={t('ad.slug')} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} required pattern="[a-z0-9-]{2,40}" /><input style={{ width: 190 }} placeholder={t('ad.name_rw')} value={f.name_rw} onChange={(e) => setF({ ...f, name_rw: e.target.value })} required />
    <input style={{ width: 190 }} placeholder={t('ad.name_en')} value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} required /><button className="btn btn-sm">{t('c.create')}</button></form>
    <Loader loading={loading} error={error} reload={reload}><div className="table-wrap"><table className="t"><tbody>{data?.items.map((c) => (<tr key={c.id}><td><code>{c.slug}</code></td><td>{lang === 'rw' ? c.name_rw : c.name_en}</td><td>{c.is_active ? t('c.is_active') : '–'}</td>
      <td><div className="actions"><button className="btn btn-ghost btn-sm" onClick={act(() => api.put(`/admin/categories/${c.id}`, { slug: c.slug, name_rw: c.name_rw, name_en: c.name_en, is_active: !c.is_active }))}>{c.is_active ? t('ad.hide') : t('ad.show')}</button>
        <button className="btn btn-danger btn-sm" onClick={() => ask(t('c.confirm_delete'), act(() => api.del(`/admin/categories/${c.id}`)))}>{t('c.delete')}</button></div></td></tr>))}</tbody></table></div></Loader>{dialog}</>);
}

export function Announcements() {
  const { t } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/admin/announcements'), []); const act = useAct(reload);
  const [f, setF] = useState({ title_rw: '', title_en: '', body_rw: '', body_en: '' });
  async function add(e: React.FormEvent) { e.preventDefault(); try { await api.post('/admin/announcements', { ...f, is_active: true }); setF({ title_rw: '', title_en: '', body_rw: '', body_en: '' }); reload(); toast.ok(t('c.saved')); } catch (x) { toast.fail(x); } }
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  return (<><h2>{t('ad.announcements')}</h2><form className="form-grid two card card-pad" onSubmit={add} style={{ marginBottom: 14 }}>
    <Field label={t('ad.title_rw')}><input value={f.title_rw} onChange={set('title_rw')} required /></Field><Field label={t('ad.title_en')}><input value={f.title_en} onChange={set('title_en')} required /></Field>
    <Field label={t('ad.body_rw')}><textarea value={f.body_rw} onChange={set('body_rw')} required /></Field><Field label={t('ad.body_en')}><textarea value={f.body_en} onChange={set('body_en')} required /></Field><div className="span2"><button className="btn">{t('c.create')}</button></div></form>
    <Loader loading={loading} error={error} reload={reload}>{data?.items.map((a) => (<div key={a.id} className="card card-pad row spread" style={{ marginBottom: 8 }}><div><strong>{a.title_rw}</strong> / {a.title_en}<div className="small muted">{a.is_active ? t('c.is_active') : '–'}</div></div>
      <div className="actions"><button className="btn btn-ghost btn-sm" onClick={act(() => api.put(`/admin/announcements/${a.id}`, { ...a, is_active: !a.is_active }))}>{a.is_active ? t('ad.hide') : t('ad.show')}</button><button className="btn btn-danger btn-sm" onClick={() => ask(t('c.confirm_delete'), act(() => api.del(`/admin/announcements/${a.id}`)))}>{t('c.delete')}</button></div></div>))}</Loader>{dialog}</>);
}

export function SettingsPage() {
  const { t } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get<any>('/admin/settings'), []); const cfg = useLoad(() => api.get<any>('/config'), []);
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (data) setF(data.settings); }, [data]);
  async function save(e: React.FormEvent) { e.preventDefault(); try { await api.put('/admin/settings', f); toast.ok(t('c.saved')); reload(); } catch (x) { toast.fail(x); } }
  const onoff = (b: boolean) => (b ? t('ad.on') : t('ad.off'));
  return (<><h2>{t('ad.settings')}</h2><Loader loading={loading} error={error} reload={reload}>{f && (
    <form className="form-grid two card card-pad" onSubmit={save}>
      <Field label={t('ad.platform_name')}><input value={f.platform_name || ''} onChange={(e) => setF({ ...f, platform_name: e.target.value })} /></Field><Field label={t('ad.contact_email')}><input type="email" value={f.contact_email || ''} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></Field>
      <Field label={t('ad.max_seats')}><input type="number" min="1" max="10" value={f.max_seats_per_registration || '10'} onChange={(e) => setF({ ...f, max_seats_per_registration: e.target.value })} /></Field>
      <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.allow_organizer_applications === 'true'} onChange={(e) => setF({ ...f, allow_organizer_applications: String(e.target.checked) })} />{t('ad.set_apps')}</label>
      <div className="span2"><button className="btn">{t('c.save')}</button></div></form>)}</Loader>
    {cfg.data && <div className="notice" style={{ marginTop: 16 }}><strong>{t('ad.sources')}</strong><br />{t('ad.sources_d', { w: onoff(cfg.data.weather_enabled), o: onoff(cfg.data.ollama_enabled), m: onoff(cfg.data.maps_embed_enabled) })}</div>}</>);
}

interface TransportTable {
  hubs: { id: number; name: string; is_default: boolean; located: boolean }[];
  destinations: { id: number; name: string; region: string; located: boolean; closest: { id: number; name: string; km: number }[] }[];
  fares: { destination_id: number; hub_id: number; amount: number }[];
  estimates: { destination_id: number; hub_id: number; km: number; amount: number }[];
  fare_per_km: number;
}

/** Public transport fares: destinations x starting locations. Used by the assistant when a trip price excludes transport. */
export function TransportPrices() {
  const { t, money } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const { data, loading, error, reload } = useLoad(() => api.get<TransportTable>('/admin/transport'), []);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ name: '', latitude: '', longitude: '' }); const [err, setErr] = useState<Record<string, string>>({});
  const key = (d: number, h: number) => `${d}:${h}`;
  const fare = useMemo(() => new Map((data?.fares || []).map((x) => [key(x.destination_id, x.hub_id), x.amount])), [data]);
  const est = useMemo(() => new Map((data?.estimates || []).map((x) => [key(x.destination_id, x.hub_id), x])), [data]);
  const value = (k: string) => (k in edits ? edits[k] : fare.get(k)?.toString() ?? '');
  const changed = Object.entries(edits).filter(([k, v]) => (v === '' ? null : Number(v)) !== (fare.get(k) ?? null));

  async function save() {
    if (!changed.length) return;
    setSaving(true);
    try {
      const r = await api.put<{ saved: number; cleared: number }>('/admin/transport/fares', { fares: changed.map(([k, v]) => {
        const [destination_id, hub_id] = k.split(':').map(Number);
        return { destination_id, hub_id, amount: v === '' ? null : Math.round(Number(v)) };
      }) });
      toast.ok(t('ad.tr_saved', { n: r.saved + r.cleared })); setEdits({}); reload();
    } catch (x) { toast.fail(x); } finally { setSaving(false); }
  }
  function fill() {
    const next = { ...edits };
    for (const [k, e] of est) if (!fare.has(k) && !(k in next)) next[k] = String(e.amount);
    setEdits(next);
  }
  async function addHub(e: React.FormEvent) {
    e.preventDefault(); setErr({});
    const body: any = { name: f.name.trim() };
    if (f.latitude !== '' || f.longitude !== '') { body.latitude = Number(f.latitude); body.longitude = Number(f.longitude); }
    try {
      const r = await api.post<{ located: boolean; matched: string | null }>('/admin/transport/hubs', body);
      if (r.located) toast.ok(t('ad.tr_located', { p: r.matched || body.name })); else toast.ok(t('ad.tr_not_located'));
      setF({ name: '', latitude: '', longitude: '' }); reload();
    } catch (x) { setErr(errs(x)); toast.fail(x); }
  }

  return (<>
    <div className="dash-head"><div><h2>{t('ad.transport')}</h2><p className="muted" style={{ maxWidth: 820 }}>{t('ad.transport_sub')}</p></div></div>
    <Loader loading={loading} error={error} reload={reload}>{data && (<div className="stack">
      <div className="row spread">
        <div className="row">
          <button className="btn" disabled={!changed.length || saving} onClick={save}>{t('ad.tr_save')}</button>
          <button className="btn btn-ghost" onClick={fill}>{t('ad.tr_fill')}</button>
          {changed.length > 0 && <span className="small muted">{t('ad.tr_unsaved', { n: changed.length })}</span>}
        </div>
        <span className="small muted">{t('ad.tr_rate', { r: data.fare_per_km })}</span>
      </div>
      {data.destinations.length === 0 ? <Empty>{t('ad.tr_no_dests')}</Empty> : (
        <div className="table-wrap"><table className="t fare-table"><thead><tr>
          <th>{t('ad.tr_destination')}</th>
          {data.hubs.map((h) => <th key={h.id}><div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>{h.name}
            {h.is_default ? <span className="pill pill-grey">{t('ad.tr_default')}</span>
              : <button className="btn btn-ghost btn-sm" aria-label={`${t('c.delete')} ${h.name}`} title={t('c.delete')} onClick={() => ask(t('c.confirm_delete'), async () => { try { await api.del(`/admin/transport/hubs/${h.id}`); reload(); } catch (x) { toast.fail(x); } })}><Icon name="x" size={13} /></button>}
          </div>{!h.located && <div className="small" style={{ fontWeight: 400 }}>{t('ad.tr_not_located')}</div>}</th>)}
        </tr></thead><tbody>
          {data.destinations.map((d) => (<tr key={d.id}>
            <td><strong>{d.name}</strong><div className="small muted">{d.region}</div>
              {d.closest.length > 0 && <div className="small muted">{t('ad.tr_closest')}: {d.closest.map((c) => `${c.name} (${c.km} km)`).join(', ')}</div>}</td>
            {data.hubs.map((h) => {
              const k = key(d.id, h.id), e = est.get(k), v = value(k);
              return (<td key={h.id} className={`${d.closest[0]?.id === h.id ? 'closest' : ''} ${k in edits && changed.some(([c]) => c === k) ? 'dirty' : ''}`}>
                <input type="number" min={0} step={100} inputMode="numeric" aria-label={`${d.name} – ${h.name}`} value={v}
                  placeholder={e ? String(e.amount) : '–'} onChange={(ev) => setEdits({ ...edits, [k]: ev.target.value })} />
                {e && <div className="small muted">{t('ad.tr_est', { n: money(e.amount), km: e.km })}</div>}
              </td>);
            })}
          </tr>))}
        </tbody></table></div>)}
      <form className="card card-pad stack" onSubmit={addHub}>
        <h3 style={{ margin: 0 }}>{t('ad.tr_add_start')}</h3>
        <div className="row">
          <Field label={t('c.name')} error={err.name}><input value={f.name} placeholder={t('ad.tr_start_name')} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={40} /></Field>
          <Field label={t('ad.tr_lat')} error={err.latitude}><input type="number" step="any" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} /></Field>
          <Field label={t('ad.tr_lng')} error={err.longitude}><input type="number" step="any" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} /></Field>
          <button className="btn" style={{ alignSelf: 'end' }}><Icon name="plus" size={14} /> {t('c.create')}</button>
        </div>
      </form>
    </div>)}</Loader>{dialog}</>);
}
