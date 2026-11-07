import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Cover } from '../../components/Cover';
import { Loader, Stars, Status, useConfirm } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/Toast';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';
import type { Trip } from '../../types';

function Weather({ id }: { id: number }) {
  const { t, tx, fmtDate } = useI18n();
  const { data, loading } = useLoad(() => api.get<any>(`/trips/${id}/weather`), [id]);
  if (loading) return null;
  return (
    <section className="card card-pad"><h3>{t('trip.weather')}</h3>
      {data?.available ? (<div className="small stack">
        <div>{fmtDate(data.date)} · {data.place}</div>
        <div>{t('weather.temp')}: <strong>{data.temp_min}°C – {data.temp_max}°C</strong></div>
        <div>{t('weather.rain')}: <strong>{data.rain_mm} mm</strong>{data.rain_probability != null && ` (${data.rain_probability}%)`}</div>
        {data.wind_kmh != null && <div>{t('weather.wind')}: <strong>{data.wind_kmh} km/h</strong></div>}
        <div className="muted">{t('weather.source')}: {data.source} · {t('weather.retrieved')}: {new Date(data.retrieved_at).toLocaleString()}</div>
      </div>) : <p className="small muted" style={{ margin: 0 }}>{t('trip.weather_unavailable')}. {tx('weather.reason.' + (data?.reason || 'provider_unreachable'))}</p>}
    </section>
  );
}

export default function TripDetail() {
  const { id } = useParams(); const loc = useLocation();
  const { t, lang, fmtDate, money, tx } = useI18n(); const { user } = useAuth(); const toast = useToast(); const { ask, dialog } = useConfirm();
  const { data, loading, error, reload } = useLoad(() => api.get<{ trip: Trip }>(`/trips/${id}`), [id]);
  const reviews = useLoad(() => api.get<{ items: any[] }>(`/trips/${id}/reviews`), [id]);
  const [seats, setSeats] = useState(1); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);

  const trip = data?.trip;
  async function register(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/trips/${id}/register`, { seats, note: note || undefined }); toast.ok(t('trip.register_ok')); await reload(); } catch (err) { toast.fail(err); }
    setBusy(false);
  }
  async function toggleSave() {
    if (!trip) return;
    try { if (trip.saved) await api.del(`/saved/${trip.id}`); else await api.put(`/saved/${trip.id}`); await reload(); } catch (err) { toast.fail(err); }
  }
  return (
    <div className="container">
      <p style={{ marginTop: 20 }}><Link to="/trips">← {t('trip.back')}</Link></p>
      <Loader loading={loading} error={error} reload={reload}>
        {trip && (() => {
          const q = trip.latitude != null ? `${trip.latitude},${trip.longitude}` : encodeURIComponent(`${trip.meeting_point}, ${trip.destination.name}, Rwanda`);
          const canReg = trip.is_open && (!user || user.role !== 'admin');
          const my = trip.my_registration && ['pending', 'approved', 'waitlisted'].includes(trip.my_registration.status) ? trip.my_registration : null;
          const maxSeats = Math.min(10, trip.remaining_spaces);
          return (
            <div className="detail-grid" style={{ paddingTop: 0 }}>
              <div className="stack">
                <div className="card" style={{ overflow: 'hidden' }}><Cover src={trip.cover_image} slug={trip.category.slug} seed={trip.id} alt={trip.title} /></div>
                {trip.images && trip.images.length > 0 && <div className="row">{trip.images.map((im) => <img key={im.id} src={im.path} alt="" style={{ width: 110, height: 76, objectFit: 'cover', borderRadius: 3 }} />)}</div>}
                <div>
                  <div className="pills"><Status kind="st" value={trip.effective_status} /><span className="pill pill-gold">{lang === 'rw' ? trip.category.name_rw : trip.category.name_en}</span>{trip.is_demo && <span className="pill pill-grey">{t('c.demo')}</span>}</div>
                  <h1 style={{ fontSize: 'clamp(1.7rem,4.5vw,2.4rem)', marginTop: 10 }}>{trip.title}</h1>
                  <p className="muted">{trip.destination.name} · {trip.destination.region}</p>
                </div>
                <dl className="facts">
                  <div><dt>{t('trip.when')}</dt><dd>{fmtDate(trip.trip_date)} · {trip.start_time}</dd></div>
                  <div><dt>{t('trip.meeting')}</dt><dd>{trip.meeting_point}</dd></div>
                  <div><dt>{t('trip.start_from')}</dt><dd>{trip.starting_location}</dd></div>
                  {trip.duration_hours && <div><dt>{t('trip.duration')}</dt><dd>{t('trip.hours', { n: trip.duration_hours })}</dd></div>}
                  <div><dt>{t('trip.difficulty')}</dt><dd>{t(`trip.diff.${trip.difficulty}` as any)}</dd></div>
                  <div><dt>{t('trip.deadline')}</dt><dd>{fmtDate(trip.registration_deadline.slice(0, 10))} {trip.registration_deadline.slice(11)}</dd></div>
                </dl>
                <section><h3>{t('trip.about')}</h3><p>{trip.description}</p></section>
                <div className="grid grid-2">
                  {trip.included_services.length > 0 && <section><h3>{t('trip.included')}</h3><ul className="list-check">{trip.included_services.map((s) => <li key={s}>{s}</li>)}</ul></section>}
                  {trip.excluded_services.length > 0 && <section><h3>{t('trip.excluded')}</h3><ul className="list-check list-x">{trip.excluded_services.map((s) => <li key={s}>{s}</li>)}</ul></section>}
                </div>
                {(trip.transport_info || trip.food_info || trip.bring_items || trip.cancellation_policy) && (
                  <section className="stack">
                    {trip.transport_info && <div><strong>{t('trip.transport')}:</strong> {trip.transport_info}</div>}
                    {trip.food_info && <div><strong>{t('trip.food')}:</strong> {trip.food_info}</div>}
                    {trip.bring_items && <div><strong>{t('trip.bring')}:</strong> {trip.bring_items}</div>}
                    {trip.cancellation_policy && <div><strong>{t('trip.cancellation')}:</strong> {trip.cancellation_policy}</div>}
                  </section>)}
                <section className="card card-pad"><h3>{t('trip.costs')}</h3><p className="small muted">{t('trip.cost_note')}</p>
                  <table className="cost-table"><tbody>{trip.costs?.map((c) => (
                    <tr key={c.id}><td>{c.label || tx('cost.' + c.cost_type)}<div className="small muted">{tx('src.' + c.source_type)}{c.source_note ? ` – ${c.source_note}` : ''}{c.scope === 'destination' ? ` (${trip.destination.name})` : ''}</div></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{c.amount != null ? money(c.amount) : t('trip.cost_unknown')}</strong></td></tr>))}</tbody></table>
                </section>
                <section className="card card-pad"><h3>{t('trip.map')}</h3>
                  <div className="row"><a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${q}`}>{t('trip.open_map')}</a>
                    <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}>{t('trip.directions')}</a></div>
                  {trip.coords_source === 'destination' && <p className="small muted" style={{ margin: '8px 0 0' }}>{t('trip.approx_coords')}</p>}
                </section>
                <Weather id={trip.id} />
                <section><h3>{t('trip.reviews')}</h3>
                  {trip.review_count > 0 && trip.avg_rating && <p><Stars n={trip.avg_rating} /> {t('trip.avg', { r: trip.avg_rating, n: trip.review_count })}</p>}
                  {reviews.data?.items.length ? reviews.data.items.map((r) => <div key={r.id} className="card card-pad" style={{ marginBottom: 8 }}><Stars n={r.rating} /> <strong>{r.reviewer}</strong><p style={{ margin: '4px 0 0' }}>{r.comment}</p></div>) : <p className="muted">{t('trip.no_reviews')}</p>}
                </section>
              </div>

              <aside className="sticky stack">
                <div className="card card-pad">
                  <div className="price-big">{trip.price === 0 ? t('c.free') : money(trip.price)}</div>
                  <div className="small muted">{tx('src.organizer')}</div>
                  <p style={{ marginTop: 10 }}>{trip.is_open ? <strong>{trip.remaining_spaces === 1 ? t('trip.spaces_one') : t('trip.spaces_left', { n: trip.remaining_spaces })}</strong> : <span className="notice notice-red" style={{ display: 'block' }}>{t('trip.closed_msg')} ({tx('st.' + trip.effective_status)})</span>}</p>
                  {my ? (
                    <div className="stack"><div className="notice notice-green"><strong>{t('trip.your_reg')}:</strong> <Status kind="rs" value={my.status} /> · {t('tr.seats')}: {my.seats}</div>
                      <button className="btn btn-ghost" onClick={() => ask(t('tr.cancel_confirm'), async () => { try { await api.patch(`/registrations/${my.id}/cancel`); toast.ok(t('tr.reg_cancelled')); reload(); } catch (e) { toast.fail(e); } })}>{t('trip.cancel_reg')}</button></div>
                  ) : canReg ? (user ? (
                    <form className="stack" onSubmit={register}>
                      <div className="field"><label htmlFor="seats">{t('trip.seats')}</label>
                        <select id="seats" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>{Array.from({ length: Math.max(1, maxSeats) }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></div>
                      <div className="field"><label htmlFor="rn">{t('trip.note')} ({t('c.optional')})</label><textarea id="rn" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></div>
                      <button className="btn btn-gold" disabled={busy}>{t('trip.register')}</button>
                    </form>) : <Link className="btn btn-gold" to={`/login?next=${encodeURIComponent(loc.pathname)}`}>{t('trip.login_to_register')}</Link>) : null}
                  {user && <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%' }} onClick={toggleSave}>{trip.saved ? t('trip.unsave') : t('trip.save')}</button>}
                </div>
                <div className="card card-pad small">
                  <div className="muted">{t('trip.organizer')}</div>
                  <strong>{trip.organizer.display_name}</strong> {trip.organizer.verified && <span className="pill">{t('c.verified')}</span>}
                  <div style={{ marginTop: 6 }}>{user ? <Link to={`/organizers/${trip.organizer.id}`}>{t('c.view')}</Link> : <span className="muted">{t('trip.view_organizer')}</span>}</div>
                </div>
              </aside>
            </div>
          );
        })()}
      </Loader>
      {dialog}
    </div>
  );
}
