import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Rating } from '../../components/Cards';
import { Cover, destImage } from '../../components/Cover';
import { Icon } from '../../components/Icon';
import { Avatar, Loader, Stars, Status, useConfirm } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/Toast';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';
import type { Trip } from '../../types';

function WeatherArt({ rainy }: { rainy: boolean }) {
  return (<svg className="sun" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="24" cy="24" r="12" fill="#f5c518" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <rect key={a} x="23" y="4" width="2.5" height="7" rx="1.2" fill="#f5c518" transform={`rotate(${a} 24 24)`} />)}
    <path d="M20 50a10 10 0 0 1 1-20 13 13 0 0 1 25 3 8.5 8.5 0 0 1 2 17z" fill="#dfe8f1" stroke="#b9c8d6" strokeWidth="1.5" />
    {rainy && [26, 34, 42].map((x) => <path key={x} d={`M${x} 54l-2 6`} stroke="#4a90d9" strokeWidth="2.5" strokeLinecap="round" />)}
  </svg>);
}

function Weather({ id }: { id: number }) {
  const { t, tx, fmtDate } = useI18n();
  const { data, loading } = useLoad(() => api.get<any>(`/trips/${id}/weather`), [id]);
  if (loading) return null;
  return (
    <div className="weather-top">
      <h3>{data?.available ? t('weather.in', { p: data.place }) : t('trip.weather')}</h3>
      {data?.available ? (<>
        <div className="muted small">{fmtDate(data.date)}</div>
        <div className="weather-main">
          <WeatherArt rainy={(data.rain_probability ?? 0) >= 50 || data.rain_mm > 2} />
          <div><div className="temp">{Math.round(data.temp_max)}°C</div><div className="small muted">{t('weather.temp')}: {data.temp_min}°C – {data.temp_max}°C</div></div>
          <div className="weather-stats">
            <div><Icon name="droplet" size={15} /><b>{data.rain_mm} mm</b><span>{t('weather.rain_short')}{data.rain_probability != null && ` · ${data.rain_probability}%`}</span></div>
            {data.wind_kmh != null && <div><Icon name="wind" size={15} /><b>{data.wind_kmh} km/h</b><span>{t('weather.wind')}</span></div>}
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 12 }}>{t('weather.source')}: {data.source} · {t('weather.retrieved')}: {new Date(data.retrieved_at).toLocaleString()}</div>
      </>) : <p className="small muted" style={{ margin: '6px 0 0' }}>{t('trip.weather_unavailable')}. {tx('weather.reason.' + (data?.reason || 'provider_unreachable'))}</p>}
    </div>
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
  const [tab, setTab] = useState('overview');
  const jump = (k: string) => { setTab(k); document.getElementById('sec-' + k)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div className="container">
      <Loader loading={loading} error={error} reload={reload}>
        {trip && (() => {
          const hasCoords = trip.latitude != null && trip.longitude != null;
          const q = hasCoords ? `${trip.latitude},${trip.longitude}` : encodeURIComponent(`${trip.meeting_point}, ${trip.destination.name}, Rwanda`);
          const canReg = trip.is_open && (!user || user.role !== 'admin');
          const my = trip.my_registration && ['pending', 'approved', 'waitlisted'].includes(trip.my_registration.status) ? trip.my_registration : null;
          const maxSeats = Math.min(10, trip.remaining_spaces);
          const cat = lang === 'rw' ? trip.category.name_rw : trip.category.name_en;
          const bbox = hasCoords ? [trip.longitude! - 0.04, trip.latitude! - 0.02, trip.longitude! + 0.04, trip.latitude! + 0.02].join(',') : '';
          const tabs: [string, string][] = [['overview', t('trip.tab.overview')], ['details', t('trip.tab.details')], ['location', t('trip.tab.location')], ['reviews', t('trip.reviews')]];
          return (<>
            <div className="detail-hero">
              <Cover src={trip.cover_image} srcs={[destImage(trip.destination.slug)]} slug={trip.category.slug} seed={trip.id} alt={trip.title} />
              <Link className="back" to="/trips"><Icon name="arrowLeft" size={15} />{t('trip.back')}</Link>
              <div className="dh-in">
                <div>
                  <div className="pills"><Status kind="st" value={trip.effective_status} /><span className="pill pill-gold">{cat}</span>{trip.is_demo && <span className="pill pill-grey">{t('c.demo')}</span>}</div>
                  <h1 className="t-poster-sm">{trip.title}</h1>
                  <div className="muted meta-line" style={{ color: '#e2ece4' }}><Icon name="pin" size={15} />{trip.destination.name} · {trip.destination.region}</div>
                </div>
                {canReg && !my && <a className="btn" href="#register">{t('trip.register_cta')}</a>}
              </div>
            </div>

            <div className="tabs-line" role="tablist">
              {tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => jump(k)}>{label}</button>)}
            </div>

            <div className="detail-grid">
              <div className="stack">
                <section id="sec-overview" className="card card-pad overview">
                  <ul className="key-facts">
                    <li><Icon name="calendar" /><span><small>{t('trip.when')}</small>{fmtDate(trip.trip_date)} · {trip.start_time}</span></li>
                    <li><Icon name="pin" /><span><small>{t('trip.meeting')}</small>{trip.meeting_point}</span></li>
                    <li><Icon name="wallet" /><span><small>{t('c.price')}</small>{trip.price === 0 ? t('c.free') : money(trip.price)}</span></li>
                    <li><Icon name="users" /><span><small>{t('trip.capacity')}</small>{trip.is_open ? (trip.remaining_spaces === 1 ? t('trip.spaces_one') : t('trip.spaces_left', { n: trip.remaining_spaces })) : tx('st.' + trip.effective_status)}</span></li>
                  </ul>
                  <div>
                    <h3>{t('trip.about')}</h3>
                    <p>{trip.description}</p>
                    {trip.images && trip.images.length > 0 && <div className="row">{trip.images.map((im) => <img key={im.id} src={im.path} alt="" style={{ width: 110, height: 76, objectFit: 'cover', borderRadius: 10 }} />)}</div>}
                  </div>
                </section>

                <section id="sec-details" className="stack">
                  <dl className="facts">
                    <div><dt>{t('trip.start_from')}</dt><dd>{trip.starting_location}</dd></div>
                    {trip.duration_hours && <div><dt>{t('trip.duration')}</dt><dd>{t('trip.hours', { n: trip.duration_hours })}</dd></div>}
                    <div><dt>{t('trip.difficulty')}</dt><dd>{t(`trip.diff.${trip.difficulty}` as any)}</dd></div>
                    <div><dt>{t('trip.deadline')}</dt><dd>{fmtDate(trip.registration_deadline.slice(0, 10))} {trip.registration_deadline.slice(11)}</dd></div>
                  </dl>
                  {(trip.included_services.length > 0 || trip.excluded_services.length > 0) && <div className="card card-pad grid grid-2">
                    {trip.included_services.length > 0 && <div><h3>{t('trip.included')}</h3><ul className="list-check">{trip.included_services.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                    {trip.excluded_services.length > 0 && <div><h3>{t('trip.excluded')}</h3><ul className="list-check list-x">{trip.excluded_services.map((x) => <li key={x}>{x}</li>)}</ul></div>}
                  </div>}
                  {(trip.transport_info || trip.food_info || trip.bring_items || trip.cancellation_policy) && (
                    <div className="card card-pad stack">
                      {trip.transport_info && <div><strong>{t('trip.transport')}:</strong> {trip.transport_info}</div>}
                      {trip.food_info && <div><strong>{t('trip.food')}:</strong> {trip.food_info}</div>}
                      {trip.bring_items && <div><strong>{t('trip.bring')}:</strong> {trip.bring_items}</div>}
                      {trip.cancellation_policy && <div><strong>{t('trip.cancellation')}:</strong> {trip.cancellation_policy}</div>}
                    </div>)}
                  <div className="card card-pad"><h3>{t('trip.costs')}</h3><p className="small muted">{t('trip.cost_note')}</p>
                    <table className="cost-table"><tbody>{trip.costs?.map((c) => (
                      <tr key={c.id}><td>{c.label || tx('cost.' + c.cost_type)}<div className="small muted">{tx('src.' + c.source_type)}{c.source_note ? ` – ${c.source_note}` : ''}{c.scope === 'destination' ? ` (${trip.destination.name})` : ''}</div></td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><strong>{c.amount != null ? money(c.amount) : t('trip.cost_unknown')}</strong></td></tr>))}</tbody></table>
                  </div>
                </section>

                <section id="sec-location" className="card weather">
                  <Weather id={trip.id} />
                  <div className="location-band">
                    <div>
                      <h4>{t('weather.meeting')}</h4>
                      <div className="meta-line"><Icon name="pin" size={16} />{trip.meeting_point}, {trip.destination.name}</div>
                      {trip.coords_source === 'destination' && <p className="small" style={{ margin: '8px 0 0', color: '#b9d0c0' }}>{t('trip.approx_coords')}</p>}
                      <div className="row" style={{ marginTop: 12 }}>
                        <a className="btn btn-sm btn-outline-light" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}>{t('trip.directions')}</a>
                      </div>
                    </div>
                    <div className="map-frame">
                      {hasCoords ? <iframe title={t('trip.map')} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${trip.latitude},${trip.longitude}`} />
                        : <Cover slug={trip.category.slug} seed={trip.id + 9} hint="map: add latitude/longitude to the trip" />}
                      <a className="btn btn-sm btn-light" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${q}`}><Icon name="map" size={14} />{t('trip.open_map')}</a>
                    </div>
                  </div>
                </section>

                <section id="sec-reviews" className="card card-pad"><h3>{t('trip.reviews')}</h3>
                  {trip.review_count > 0 && trip.avg_rating && <p className="row" style={{ gap: 8 }}><Stars n={trip.avg_rating} /> {t('trip.avg', { r: trip.avg_rating, n: trip.review_count })}</p>}
                  {reviews.data?.items.length ? reviews.data.items.map((r) => <div key={r.id} className="review"><Avatar name={r.reviewer} /><div><strong>{r.reviewer}</strong> <Stars n={r.rating} /><p style={{ margin: '4px 0 0' }}>{r.comment}</p></div></div>) : <p className="muted" style={{ margin: 0 }}>{t('trip.no_reviews')}</p>}
                </section>
              </div>

              <aside className="sticky stack">
                <div className="card card-pad" id="register">
                  <div className="price-big">{trip.price === 0 ? t('c.free') : money(trip.price)}</div>
                  <div className="small muted">{tx('src.organizer')}</div>
                  <p style={{ marginTop: 10 }}>{trip.is_open ? <span className="spots"><Icon name="users" size={15} />{trip.remaining_spaces === 1 ? t('trip.spaces_one') : t('trip.spaces_left', { n: trip.remaining_spaces })}</span> : <span className="notice notice-red" style={{ display: 'block' }}>{t('trip.closed_msg')} ({tx('st.' + trip.effective_status)})</span>}</p>
                  {my ? (
                    <div className="stack"><div className="notice notice-green"><strong>{t('trip.your_reg')}:</strong> <Status kind="rs" value={my.status} /> · {t('tr.seats')}: {my.seats}</div>
                      <button className="btn btn-ghost btn-block" onClick={() => ask(t('tr.cancel_confirm'), async () => { try { await api.patch(`/registrations/${my.id}/cancel`); toast.ok(t('tr.reg_cancelled')); reload(); } catch (e) { toast.fail(e); } })}>{t('trip.cancel_reg')}</button></div>
                  ) : canReg ? (user ? (
                    <form className="stack" onSubmit={register}>
                      <div className="field"><label htmlFor="seats">{t('trip.seats')}</label>
                        <select id="seats" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>{Array.from({ length: Math.max(1, maxSeats) }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></div>
                      <div className="field"><label htmlFor="rn">{t('trip.note')} ({t('c.optional')})</label><textarea id="rn" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></div>
                      <button className="btn btn-block" disabled={busy}>{t('trip.register')}</button>
                    </form>) : <Link className="btn btn-block" to={`/login?next=${encodeURIComponent(loc.pathname)}`}>{t('trip.login_to_register')}</Link>) : null}
                  {user && <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 10 }} onClick={toggleSave}><Icon name="heart" size={14} fill={trip.saved} />{trip.saved ? t('trip.unsave') : t('trip.save')}</button>}
                </div>
                <div className="card card-pad">
                  <div className="small muted" style={{ marginBottom: 8 }}>{t('trip.organizer')}</div>
                  <div className="org-card"><Avatar name={trip.organizer.display_name} size="lg" />
                    <div><strong>{trip.organizer.display_name}</strong>{trip.organizer.verified && <div><span className="pill"><Icon name="check" size={11} />{t('c.verified')}</span></div>}</div></div>
                  {trip.avg_rating ? <div style={{ marginTop: 10 }}><Rating value={trip.avg_rating} count={trip.review_count} /> <span className="small muted">{t('trip.reviews_n', { n: trip.review_count })}</span></div> : null}
                  <div style={{ marginTop: 12 }}>{user ? <Link className="btn btn-ghost btn-sm" to={`/organizers/${trip.organizer.id}`}>{t('trip.view_profile')}</Link> : <span className="small muted">{t('trip.view_organizer')}</span>}</div>
                </div>
              </aside>
            </div>
          </>);
        })()}
      </Loader>
      {dialog}
    </div>
  );
}
