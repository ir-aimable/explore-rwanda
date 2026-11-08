import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, Empty, Field, Kpi, Loader, Status, useConfirm } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Cover, destImage } from '../../components/Cover';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/Toast';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { ApiError, api } from '../../services/api';
import type { Category, Destination, Trip } from '../../types';
import { Stars } from '../../components/ui';

export function OrganizerHome() {
  const { t, fmtDate } = useI18n(); const { user } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api.get<any>('/organizer/me'), []);
  const regs = useLoad(() => api.get<{ items: any[] }>('/registrations/manage?status=&q='), []);
  const trips = useLoad(() => api.get<{ items: any[] }>('/trips/manage/mine'), []);
  return (<div className="stack">
    {user?.organizer?.status === 'suspended' && <div className="notice notice-red">{t('org.suspended')}</div>}
    <Loader loading={loading} error={error} reload={reload}>{data && (<div className="stack">
      <div className="dash-head"><div><h1>{t('dash.welcome', { name: data.organizer.display_name })}</h1><p>{t('dash.welcome_sub')}</p></div><Link className="btn" to="/organizer/trips/new"><Icon name="plus" size={16} />{t('org.create_trip')}</Link></div>
      <div className="kpis">
        <Kpi icon="mountain" value={data.stats.total} label={t('org.stat.trips')} />
        <Kpi icon="checkCircle" value={data.stats.published ?? 0} label={t('org.stat.published')} />
        <Kpi icon="list" value={data.stats.drafts ?? 0} label={t('org.stat.drafts')} />
        <Kpi icon="clock" tone="gold" value={data.stats.pending} label={t('org.stat.pending')} />
        <Kpi icon="users" value={data.stats.confirmed} label={t('org.stat.confirmed')} />
      </div>
      <div className="dash-cols">
        <div className="card card-pad"><div className="panel-head"><h3>{t('org.registrations')}</h3><Link className="see-all small" to="/organizer/registrations">{t('dash.view_all')} <Icon name="arrowRight" size={14} /></Link></div>
          {regs.data?.items.length ? regs.data.items.slice(0, 5).map((r) => <div key={r.id} className="list-row"><Avatar name={r.full_name} />
            <div className="grow"><strong>{r.full_name}</strong><span className="small muted">{r.title} · {fmtDate(r.created_at.slice(0, 10))}</span></div><Status kind="rs" value={r.status} /></div>) : <Empty>{t('org.no_regs')}</Empty>}
        </div>
        <div className="card card-pad"><div className="panel-head"><h3>{t('org.my_trips')}</h3><Link className="see-all small" to="/organizer/trips">{t('dash.view_all')} <Icon name="arrowRight" size={14} /></Link></div>
          {trips.data?.items.length ? trips.data.items.slice(0, 4).map((x) => <div key={x.id} className="list-row"><span style={{ width: 54, flex: 'none', borderRadius: 8, overflow: 'hidden' }}><Cover src={x.cover_image} srcs={[destImage(x.destination.slug)]} slug={x.category.slug} seed={x.id} /></span>
            <div className="grow"><strong>{x.title}</strong><span className="small muted">{fmtDate(x.trip_date)} · {x.approved_seats}/{x.capacity}</span></div><Link className="btn btn-ghost btn-sm" to={`/organizer/trips/${x.id}/registrations`}>{t('c.view')}</Link></div>) : <Empty>{t('org.no_trips')}</Empty>}
        </div>
      </div>
    </div>)}</Loader></div>);
}

export function ManageTrips({ admin }: { admin?: boolean }) {
  const { t, fmtDate, money } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm(); const base = admin ? '/admin/trips' : '/organizer/trips';
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>(admin ? '/trips/manage/all' : '/trips/manage/mine'), []);
  const act = (fn: () => Promise<unknown>) => async () => { try { await fn(); reload(); } catch (e) { toast.fail(e); } };
  return (<><div className="row spread"><h2>{admin ? t('ad.trips') : t('org.my_trips')}</h2><Link className="btn" to={`${base}/new`}>{t('org.create_trip')}</Link></div>
    <Loader loading={loading} error={error} reload={reload}>
      {data?.items.length ? <div className="table-wrap"><table className="t"><thead><tr><th>{t('c.title')}</th><th>{t('c.date')}</th><th>{t('c.price')}</th><th>{t('org.spaces')}</th><th>{t('c.status')}</th><th>{t('c.actions')}</th></tr></thead><tbody>
        {data.items.map((x: any) => (<tr key={x.id}><td><Link to={`/trips/${x.id}`}>{x.title}</Link><div className="small muted">{x.destination.name}{admin ? ` · ${x.organizer.display_name}` : ''}</div></td><td>{fmtDate(x.trip_date)} {x.start_time}</td><td>{money(x.price)}</td>
          <td>{x.approved_seats} / {x.capacity}{x.pending_seats > 0 && <span className="pill pill-gold" style={{ marginLeft: 6 }}>+{x.pending_seats}</span>}</td><td><Status kind="st" value={x.effective_status} /></td>
          <td><div className="actions">
            {!['cancelled', 'completed'].includes(x.effective_status) && <Link className="btn btn-ghost btn-sm" to={`${base}/${x.id}/edit`}>{t('c.edit')}</Link>}
            <Link className="btn btn-ghost btn-sm" to={`${base}/${x.id}/registrations`}>{t('org.registrations')}</Link>
            {x.status === 'draft' && <button className="btn btn-sm" onClick={act(() => api.post(`/trips/${x.id}/publish`))}>{t('org.publish')}</button>}
            {x.status === 'published' && x.effective_status !== 'completed' && <button className="btn btn-ghost btn-sm" onClick={act(() => api.post(`/trips/${x.id}/unpublish`))}>{t('org.unpublish')}</button>}
            {!['cancelled', 'completed'].includes(x.effective_status) && x.status !== 'draft' && <button className="btn btn-ghost btn-sm" onClick={() => ask(t('org.cancel_trip_confirm'), act(() => api.post(`/trips/${x.id}/cancel`)))}>{t('org.cancel_trip')}</button>}
            <button className="btn btn-danger btn-sm" onClick={() => ask(t('org.delete_confirm'), act(() => api.del(`/trips/${x.id}${admin ? '?force=true' : ''}`)))}>{t('c.delete')}</button></div></td></tr>))}
      </tbody></table></div> : <Empty>{t('org.no_trips')}</Empty>}
    </Loader>{dialog}</>);
}

const empty = { title: '', description: '', destination_id: '', category_id: '', starting_location: '', meeting_point: '', trip_date: '', start_time: '07:00', duration_hours: '', price: '', included: '', excluded: '', transport_info: '', food_info: '', bring_items: '', difficulty: 'easy', capacity: '10', registration_deadline: '', cancellation_policy: '', latitude: '', longitude: '', publish: false, organizer_id: '' };

export function TripForm({ admin }: { admin?: boolean }) {
  const { id } = useParams(); const nav = useNavigate(); const { t, lang, tx, money } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const base = admin ? '/admin/trips' : '/organizer/trips';
  const dests = useLoad(() => api.get<{ items: Destination[] }>('/destinations'), []);
  const cats = useLoad(() => api.get<{ items: Category[] }>('/categories'), []);
  const orgs = useLoad(() => (admin ? api.get<{ items: any[] }>('/admin/organizers') : Promise.resolve({ items: [] })), []);
  const [f, setF] = useState<any>(empty); const [err, setErr] = useState<Record<string, string>>({}); const [trip, setTrip] = useState<Trip | null>(null); const [busy, setBusy] = useState(false);
  const [cost, setCost] = useState({ cost_type: 'food', label: '', amount: '' });
  const load = () => api.get<{ trip: Trip }>(`/trips/${id}`).then(({ trip: x }) => {
    setTrip(x);
    setF({ ...empty, title: x.title, description: x.description, destination_id: x.destination.id, category_id: x.category.id, starting_location: x.starting_location, meeting_point: x.meeting_point,
      trip_date: x.trip_date, start_time: x.start_time, duration_hours: x.duration_hours ?? '', price: x.price, included: x.included_services.join('\n'), excluded: x.excluded_services.join('\n'),
      transport_info: x.transport_info ?? '', food_info: x.food_info ?? '', bring_items: x.bring_items ?? '', difficulty: x.difficulty, capacity: x.capacity, registration_deadline: x.registration_deadline,
      cancellation_policy: x.cancellation_policy ?? '', publish: x.status === 'published', latitude: (x.coords_source === 'trip' ? x.latitude : '') ?? '', longitude: (x.coords_source === 'trip' ? x.longitude : '') ?? '', organizer_id: x.organizer.id });
  }).catch((e) => toast.fail(e));
  useEffect(() => { if (id) load(); /* eslint-disable-next-line */ }, [id]);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr({}); setBusy(true);
    const body: any = { title: f.title, description: f.description, destination_id: Number(f.destination_id), category_id: Number(f.category_id), starting_location: f.starting_location, meeting_point: f.meeting_point,
      trip_date: f.trip_date, start_time: f.start_time, duration_hours: f.duration_hours === '' ? null : Number(f.duration_hours), price: Number(f.price), included_services: lines(f.included), excluded_services: lines(f.excluded),
      transport_info: f.transport_info || null, food_info: f.food_info || null, bring_items: f.bring_items || null, difficulty: f.difficulty, capacity: Number(f.capacity), registration_deadline: f.registration_deadline,
      cancellation_policy: f.cancellation_policy || null, latitude: f.latitude === '' ? null : Number(f.latitude), longitude: f.longitude === '' ? null : Number(f.longitude), status: f.publish ? 'published' : 'draft' };
    if (admin) body.organizer_id = Number(f.organizer_id);
    try {
      if (id) { await api.put(`/trips/${id}`, body); toast.ok(t('org.trip_saved')); load(); }
      else { const r = await api.post<{ trip: Trip }>('/trips', body); toast.ok(t('org.trip_saved')); nav(`${base}/${r.trip.id}/edit`); }
    } catch (x) { if (x instanceof ApiError && x.details) setErr(x.details); toast.fail(x); }
    setBusy(false);
  }
  async function upload(file: File | undefined, cover: boolean) { if (!file) return; try { await api.upload(`/trips/${id}/images${cover ? '?cover=true' : ''}`, file); toast.ok(t('c.saved')); load(); } catch (x) { toast.fail(x); } }
  async function addCost(e: React.FormEvent) { e.preventDefault(); try { await api.post('/costs', { trip_id: Number(id), cost_type: cost.cost_type, label: cost.label || undefined, amount: cost.amount === '' ? null : Number(cost.amount), source_type: 'organizer' }); setCost({ cost_type: 'food', label: '', amount: '' }); load(); } catch (x) { toast.fail(x); } }
  return (<><div className="row spread"><h2>{id ? t('org.edit_trip') : t('org.create_trip')}</h2><Link to={base}>← {t('c.back')}</Link></div>
    <form className="form-grid two" onSubmit={submit}>
      {admin && <Field className="span2" label={t('form.organizer')} error={err.organizer_id}><select value={f.organizer_id} onChange={set('organizer_id')} required disabled={!!id}><option value="" />{orgs.data?.items.filter((o: any) => o.status === 'approved').map((o: any) => <option key={o.id} value={o.id}>{o.display_name}</option>)}</select></Field>}
      <Field className="span2" label={t('form.title')} error={err.title}><input value={f.title} onChange={set('title')} required /></Field>
      <Field className="span2" label={t('form.description')} error={err.description}><textarea value={f.description} onChange={set('description')} required /></Field>
      <Field label={t('form.destination')} error={err.destination_id}><select value={f.destination_id} onChange={set('destination_id')} required><option value="" />{dests.data?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
      <Field label={t('form.category')} error={err.category_id}><select value={f.category_id} onChange={set('category_id')} required><option value="" />{cats.data?.items.map((c) => <option key={c.id} value={c.id}>{lang === 'rw' ? c.name_rw : c.name_en}</option>)}</select></Field>
      <Field label={t('form.starting')} error={err.starting_location}><input value={f.starting_location} onChange={set('starting_location')} required /></Field>
      <Field label={t('form.meeting')} error={err.meeting_point}><input value={f.meeting_point} onChange={set('meeting_point')} required /></Field>
      <Field label={t('form.date')} error={err.trip_date}><input type="date" value={f.trip_date} onChange={set('trip_date')} required /></Field>
      <Field label={t('form.time')} error={err.start_time}><input type="time" value={f.start_time} onChange={set('start_time')} required /></Field>
      <Field label={t('form.deadline')} error={err.registration_deadline}><input type="datetime-local" value={f.registration_deadline} onChange={set('registration_deadline')} required /></Field>
      <Field label={t('form.duration')} error={err.duration_hours}><input type="number" step="0.5" min="0.5" value={f.duration_hours} onChange={set('duration_hours')} /></Field>
      <Field label={t('form.price')} error={err.price}><input type="number" min="0" step="100" value={f.price} onChange={set('price')} required /></Field>
      <Field label={t('form.capacity')} error={err.capacity}><input type="number" min="1" max="500" value={f.capacity} onChange={set('capacity')} required /></Field>
      <Field label={t('form.difficulty')}><select value={f.difficulty} onChange={set('difficulty')}>{['easy', 'moderate', 'challenging'].map((d) => <option key={d} value={d}>{t(`trip.diff.${d}` as any)}</option>)}</select></Field>
      <Field label={t('form.included')}><textarea value={f.included} onChange={set('included')} /></Field>
      <Field label={t('form.excluded')}><textarea value={f.excluded} onChange={set('excluded')} /></Field>
      <Field label={t('form.transport')}><input value={f.transport_info} onChange={set('transport_info')} /></Field>
      <Field label={t('form.food')}><input value={f.food_info} onChange={set('food_info')} /></Field>
      <Field label={t('form.bring')}><input value={f.bring_items} onChange={set('bring_items')} /></Field>
      <Field label={t('form.cancellation')}><input value={f.cancellation_policy} onChange={set('cancellation_policy')} /></Field>
      <Field label={t('form.lat')} error={err.latitude}><input type="number" step="any" value={f.latitude} onChange={set('latitude')} /></Field>
      <Field label={t('form.lng')} error={err.longitude}><input type="number" step="any" value={f.longitude} onChange={set('longitude')} /></Field>
      <label className="check span2"><input type="checkbox" checked={f.publish} onChange={set('publish')} />{t('form.publish_now')}</label>
      <div className="span2"><button className="btn" disabled={busy}>{t('c.save')}</button></div>
    </form>
    <section className="card card-pad stack" style={{ marginTop: 24 }}><h3>{t('trip.gallery')}</h3>
      {!id ? <p className="muted">{t('org.save_first')}</p> : (<>
        {trip?.cover_image && <img src={trip.cover_image} alt="" style={{ maxWidth: 260, borderRadius: 3 }} />}
        <div className="row"><label className="btn btn-ghost btn-sm">{t('org.upload_cover')}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0], true)} /></label>
          <label className="btn btn-ghost btn-sm">{t('org.add_photo')}<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0], false)} /></label></div>
        <div className="row">{trip?.images?.map((im) => <div key={im.id}><img src={im.path} alt="" style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 3 }} />
          <button className="link-btn small" onClick={() => ask(t('c.confirm_delete'), async () => { await api.del(`/trips/${id}/images/${im.id}`); load(); })}>{t('c.delete')}</button></div>)}</div></>)}
    </section>
    {id && <section className="card card-pad stack" style={{ marginTop: 16 }}><h3>{t('trip.costs')}</h3>
      <table className="cost-table"><tbody>{trip?.costs?.filter((c) => c.scope === 'trip').map((c) => <tr key={c.id}><td>{c.label || tx('cost.' + c.cost_type)} <span className="small muted">({tx('src.' + c.source_type)})</span></td><td>{c.amount != null ? money(c.amount) : t('trip.cost_unknown')}</td>
        <td>{c.cost_type !== 'package' && <button className="link-btn" onClick={async () => { await api.del(`/costs/${c.id}`); load(); }}>{t('c.delete')}</button>}</td></tr>)}</tbody></table>
      <form className="row" onSubmit={addCost}><select style={{ width: 'auto' }} value={cost.cost_type} onChange={(e) => setCost({ ...cost, cost_type: e.target.value })}>{['transport', 'entry_fee', 'food', 'accommodation', 'activity', 'other'].map((c) => <option key={c} value={c}>{tx('cost.' + c)}</option>)}</select>
        <input style={{ width: 160 }} placeholder={t('org.cost_label')} value={cost.label} onChange={(e) => setCost({ ...cost, label: e.target.value })} /><input style={{ width: 140 }} type="number" min="0" placeholder={t('org.cost_amount')} value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} /><button className="btn btn-sm">{t('org.add_cost')}</button></form></section>}
    {dialog}</>);
}

export function TripRegistrations({ admin }: { admin?: boolean }) {
  const { id } = useParams(); const { t, fmtDate } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get<any>(`/trips/${id}/registrations`), [id]);
  const decide = async (rid: number, decision: string) => { try { await api.patch(`/registrations/${rid}/decision`, { decision }); reload(); } catch (e) { toast.fail(e); } };
  const items = data?.items || [];
  const Table = ({ rows }: { rows: any[] }) => rows.length ? <div className="table-wrap"><table className="t"><thead><tr><th>{t('c.name')}</th><th>{t('c.email')} / {t('c.phone')}</th><th>{t('tr.seats')}</th><th>{t('org.requested')}</th><th>{t('c.status')}</th><th /></tr></thead><tbody>
    {rows.map((r) => (<tr key={r.id}><td>{r.full_name}{r.note && <div className="small muted">“{r.note}”</div>}</td><td>{r.email}<div className="small muted">{r.phone}</div></td><td>{r.seats}</td><td>{fmtDate(r.created_at.slice(0, 10))}</td><td><Status kind="rs" value={r.status} /></td>
      <td><div className="actions">{['pending', 'waitlisted', 'rejected'].includes(r.status) && <button className="btn btn-sm" onClick={() => decide(r.id, 'approved')}>{t('org.decision_approve')}</button>}
        {['pending', 'approved', 'waitlisted'].includes(r.status) && <button className="btn btn-ghost btn-sm" onClick={() => decide(r.id, 'rejected')}>{t('org.decision_reject')}</button>}</div></td></tr>))}</tbody></table></div> : <Empty>{t('org.no_regs')}</Empty>;
  return (<><div className="row spread"><h2>{data?.trip?.title ?? t('org.registrations')}</h2><Link to={admin ? '/admin/trips' : '/organizer/trips'}>← {t('c.back')}</Link></div>
    <Loader loading={loading} error={error} reload={reload}>
      <p className="muted">{t('org.spaces')}: <strong>{data?.trip.approved_seats} / {data?.trip.capacity}</strong></p>
      <h3>{t('org.pending')}</h3><Table rows={items.filter((r: any) => r.status === 'pending')} />
      <h3 style={{ marginTop: 22 }}>{t('org.confirmed')}</h3><Table rows={items.filter((r: any) => r.status === 'approved')} />
      <h3 style={{ marginTop: 22 }}>{t('c.all')}</h3><Table rows={items.filter((r: any) => !['pending', 'approved'].includes(r.status))} /></Loader></>);
}

export function AllRegistrations({ admin }: { admin?: boolean }) {
  const { t, fmtDate } = useI18n(); const toast = useToast(); const [status, setStatus] = useState('pending'); const [q, setQ] = useState('');
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>(`/registrations/manage?status=${status}&q=${encodeURIComponent(q)}`), [status, q]);
  const decide = async (rid: number, decision: string) => { try { await api.patch(`/registrations/${rid}/decision`, { decision }); reload(); } catch (e) { toast.fail(e); } };
  return (<><h2>{admin ? t('ad.registrations') : t('org.registrations')}</h2>
    <div className="row" style={{ marginBottom: 12 }}><select style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('c.status')}><option value="">{t('c.all')}</option>{['pending', 'approved', 'rejected', 'cancelled'].map((s) => <option key={s} value={s}>{t(`rs.${s}` as any)}</option>)}</select>
      <input style={{ maxWidth: 280 }} placeholder={t('c.search_ph')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
    <Loader loading={loading} error={error} reload={reload}>{data?.items.length ? <div className="table-wrap"><table className="t"><thead><tr><th>{t('c.name')}</th><th>{t('nav.trips')}</th><th>{t('tr.seats')}</th><th>{t('org.requested')}</th><th>{t('c.status')}</th><th /></tr></thead><tbody>
      {data.items.map((r) => (<tr key={r.id}><td>{r.full_name}<div className="small muted">{r.email}</div></td><td><Link to={`/trips/${r.trip_id}`}>{r.title}</Link>{admin && <div className="small muted">{r.organizer_name}</div>}</td><td>{r.seats}</td><td>{fmtDate(r.created_at.slice(0, 10))}</td><td><Status kind="rs" value={r.status} /></td>
        <td><div className="actions">{['pending', 'rejected'].includes(r.status) && <button className="btn btn-sm" onClick={() => decide(r.id, 'approved')}>{t('org.decision_approve')}</button>}{['pending', 'approved'].includes(r.status) && <button className="btn btn-ghost btn-sm" onClick={() => decide(r.id, 'rejected')}>{t('org.decision_reject')}</button>}</div></td></tr>))}</tbody></table></div> : <Empty>{t('org.no_regs')}</Empty>}</Loader></>);
}

export function OrganizerProfileEdit() {
  const { t } = useI18n(); const toast = useToast(); const { refresh } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api.get<any>('/organizer/me'), []);
  const [f, setF] = useState<any>(null); const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setF({ display_name: data.organizer.display_name, bio: data.organizer.bio || '', location: data.organizer.location || '', contact_phone: data.organizer.contact_phone || '', contact_email: data.organizer.contact_email || '' }); }, [data]);
  async function save(e: React.FormEvent) { e.preventDefault(); setErr({}); try { await api.put('/organizer/me', f); toast.ok(t('dash.profile_saved')); reload(); refresh(); } catch (x) { if (x instanceof ApiError && x.details) setErr(x.details); toast.fail(x); } }
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  return (<><h2>{t('dash.profile')}</h2><Loader loading={loading} error={error} reload={reload}>{f && (
    <form className="form-grid two card card-pad" onSubmit={save}><p className="small muted span2" style={{ margin: 0 }}>{t('org.profile_public')}</p>
      <Field label={t('org.display_name')} error={err.display_name}><input value={f.display_name} onChange={set('display_name')} required /></Field><Field label={t('c.location')}><input value={f.location} onChange={set('location')} /></Field>
      <Field label={t('org.contact_email')} error={err.contact_email}><input type="email" value={f.contact_email} onChange={set('contact_email')} /></Field><Field label={t('org.contact_phone')} error={err.contact_phone}><input value={f.contact_phone} onChange={set('contact_phone')} /></Field>
      <Field className="span2" label={t('org.bio')}><textarea value={f.bio} onChange={set('bio')} /></Field><div className="span2 row"><button className="btn">{t('c.save')}</button><Link to={`/organizers/${data.organizer.id}`}>{t('org.view_public')}</Link></div></form>)}</Loader></>);
}

export function OrganizerReviews() {
  const { t, fmtDate } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/reviews/organizer'), []);
  return (<><h2>{t('org.reviews')}</h2><Loader loading={loading} error={error} reload={reload}>{data?.items.length ? data.items.map((r) => <div key={r.id} className="card card-pad" style={{ marginBottom: 8 }}><Stars n={r.rating} /> <strong>{r.title}</strong> <span className="small muted">{r.reviewer} · {fmtDate(r.created_at.slice(0, 10))}</span><p style={{ margin: '4px 0 0' }}>{r.comment}</p></div>) : <Empty>{t('trip.no_reviews')}</Empty>}</Loader></>);
}
