import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Field, Loader, Modal, Status, useConfirm } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/Toast';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { ApiError, api } from '../../services/api';

export function TravelerHome() {
  const { t, tx } = useI18n(); const { user } = useAuth();
  const regs = useLoad(() => api.get<{ items: any[] }>('/registrations/mine'), []);
  const elig = useLoad(() => api.get<{ items: any[] }>('/reviews/eligible'), []);
  const saved = useLoad(() => api.get<{ items: any[] }>('/saved'), []);
  const app = user?.application;
  return (<div className="stack"><h2>{t('dash.overview')}</h2><p>{user?.full_name}</p>
    <div className="stats">
      <div className="stat"><b>{regs.data?.items.length ?? '–'}</b><span>{t('tr.registrations')}</span></div>
      <div className="stat warn"><b>{regs.data?.items.filter((r) => r.status === 'pending').length ?? '–'}</b><span>{tx('rs.pending')}</span></div>
      <div className="stat"><b>{saved.data?.items.length ?? '–'}</b><span>{t('tr.saved')}</span></div>
      <div className="stat"><b>{elig.data?.items.length ?? '–'}</b><span>{t('tr.reviews')}</span></div></div>
    <div className="card card-pad"><h3>{t('tr.apply_status')}</h3>
      {app ? <p style={{ margin: 0 }}>{app.organizer_name}: <Status kind="as" value={app.status} />{app.review_note ? ` – ${app.review_note}` : ''}</p> : <p style={{ margin: 0 }}><Link to="/become-organizer">{t('nav.organizer_apply')}</Link></p>}</div></div>);
}

export function MyRegistrations() {
  const { t, fmtDate, money } = useI18n(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/registrations/mine'), []);
  return (<><h2>{t('tr.registrations')}</h2>
    <Loader loading={loading} error={error} reload={reload}>
      {data?.items.length ? <div className="table-wrap"><table className="t"><thead><tr><th>{t('nav.trips')}</th><th>{t('c.date')}</th><th>{t('tr.seats')}</th><th>{t('c.price')}</th><th>{t('c.status')}</th><th /></tr></thead><tbody>
        {data.items.map((r) => (<tr key={r.id}><td><Link to={`/trips/${r.trip_id}`}>{r.title}</Link><div className="small muted">{r.destination_name} · {r.organizer_name}</div></td>
          <td>{fmtDate(r.trip_date)} {r.start_time}</td><td>{r.seats}</td><td>{money(r.price * r.seats)}</td><td><Status kind="rs" value={r.status} /></td>
          <td>{['pending', 'approved', 'waitlisted'].includes(r.status) && r.trip_effective_status !== 'completed' && <button className="btn btn-ghost btn-sm" onClick={() => ask(t('tr.cancel_confirm'), async () => { try { await api.patch(`/registrations/${r.id}/cancel`); toast.ok(t('tr.reg_cancelled')); reload(); } catch (e) { toast.fail(e); } })}>{t('c.cancel')}</button>}</td></tr>))}
      </tbody></table></div> : <Empty>{t('tr.no_regs')} <Link to="/trips">{t('nav.trips')}</Link></Empty>}
    </Loader>{dialog}</>);
}

export function SavedTrips() {
  const { t, fmtDate, money } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/saved'), []);
  return (<><h2>{t('tr.saved')}</h2><Loader loading={loading} error={error} reload={reload}>
    {data?.items.length ? <div className="table-wrap"><table className="t"><tbody>{data.items.map((s) => (<tr key={s.id}><td><Link to={`/trips/${s.id}`}>{s.title}</Link><div className="small muted">{s.destination_name}</div></td><td>{fmtDate(s.trip_date)}</td><td>{money(s.price)}</td>
      <td><button className="btn btn-ghost btn-sm" onClick={async () => { try { await api.del(`/saved/${s.id}`); reload(); } catch (e) { toast.fail(e); } }}>{t('trip.unsave')}</button></td></tr>))}</tbody></table></div> : <Empty>{t('tr.no_saved')}</Empty>}</Loader></>);
}

export function MyReviews() {
  const { t, fmtDate } = useI18n(); const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/reviews/eligible'), []);
  const [open, setOpen] = useState<any>(null); const [rating, setRating] = useState(5); const [comment, setComment] = useState('');
  async function send(e: React.FormEvent) { e.preventDefault(); try { await api.post(`/trips/${open.trip_id}/reviews`, { rating, comment }); toast.ok(t('tr.review_sent')); setOpen(null); setComment(''); reload(); } catch (x) { toast.fail(x); } }
  return (<><h2>{t('tr.reviews')}</h2><Loader loading={loading} error={error} reload={reload}>
    {data?.items.length ? <div className="table-wrap"><table className="t"><tbody>{data.items.map((r) => (<tr key={r.trip_id}><td><Link to={`/trips/${r.trip_id}`}>{r.title}</Link></td><td>{fmtDate(r.trip_date)}</td><td><button className="btn btn-sm" onClick={() => setOpen(r)}>{t('tr.write_review')}</button></td></tr>))}</tbody></table></div> : <Empty>{t('tr.no_reviews')}</Empty>}</Loader>
    {open && <Modal title={`${t('tr.write_review')}: ${open.title}`} onClose={() => setOpen(null)}><form className="stack" onSubmit={send}>
      <Field label={t('c.rating')}><select value={rating} onChange={(e) => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</select></Field>
      <Field label={t('c.comment')}><textarea value={comment} onChange={(e) => setComment(e.target.value)} required minLength={3} /></Field>
      <div className="row"><button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>{t('c.cancel')}</button><button className="btn">{t('c.submit')}</button></div></form></Modal>}</>);
}

export function MySupport() {
  const { t, tx } = useI18n(); const { user } = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get<{ items: any[] }>('/support/mine'), []);
  const [f, setF] = useState({ subject: '', message: '' }); const [err, setErr] = useState<Record<string, string>>({});
  async function send(e: React.FormEvent) { e.preventDefault(); setErr({}); try { await api.post('/support', { name: user!.full_name, email: user!.email, ...f }); toast.ok(t('tr.support_sent')); setF({ subject: '', message: '' }); reload(); } catch (x) { if (x instanceof ApiError && x.details) setErr(x.details); toast.fail(x); } }
  return (<div className="stack"><h2>{t('dash.support')}</h2>
    <form className="card card-pad stack" onSubmit={send}><h3 style={{ margin: 0 }}>{t('tr.new_support')}</h3>
      <Field label={t('c.subject')} error={err.subject}><input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required /></Field>
      <Field label={t('c.message')} error={err.message}><textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required /></Field><div><button className="btn">{t('c.send')}</button></div></form>
    <Loader loading={loading} error={error} reload={reload}>{data?.items.map((s) => (<div key={s.id} className="card card-pad"><strong>{s.subject}</strong> <span className="pill pill-grey">{tx('ss.' + s.status)}</span><p className="small" style={{ margin: '4px 0' }}>{s.message}</p>{s.admin_reply && <div className="notice small"><strong>{t('tr.admin_reply')}:</strong> {s.admin_reply}</div>}</div>))}</Loader></div>);
}
