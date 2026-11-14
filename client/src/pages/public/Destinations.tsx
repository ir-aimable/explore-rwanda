import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DestinationCard, TripCard } from '../../components/Cards';
import { Cover, HeroImage, destImage } from '../../components/Cover';
import { Icon } from '../../components/Icon';
import { Avatar, Empty, Loader, Modal, Stars } from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { api, qs } from '../../services/api';
import type { Category, Destination, Trip } from '../../types';

export function Destinations() {
  const { t, lang } = useI18n(); const [q, setQ] = useState(''); const [cat, setCat] = useState('');
  const cats = useLoad(() => api.get<{ items: Category[] }>('/categories'), []);
  const list = useLoad(() => api.get<{ items: Destination[] }>(`/destinations${qs({ q, category: cat })}`), [q, cat]);
  return (
    <>
      <section className="banner">
        <HeroImage src="/images/destinations-hero.jpg" slug="nature" seed={8} />
        <div className="banner-in">
          <span className="t-script kicker">{t('poster.dest.top')}</span>
          <h1 className="t-poster">{t('dest.title')}</h1>
          <p>{t('dest.hero_sub')}</p>
          <div className="banner-search"><Icon name="search" /><label htmlFor="dq" className="sr-only">{t('dest.filter')}</label>
            <input id="dq" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dest.filter') + '…'} /></div>
        </div>
      </section>
      <div className="container section-tight">
        <div className="chip-tabs" role="group" aria-label={t('trips.activity')}>
          <button aria-pressed={cat === ''} onClick={() => setCat('')}>{t('c.all')}</button>
          {cats.data?.items.map((c) => <button key={c.id} aria-pressed={cat === c.slug} onClick={() => setCat(c.slug)}>{lang === 'rw' ? c.name_rw : c.name_en}</button>)}
        </div>
        <p className="small muted center" style={{ margin: '0 auto 18px' }}>{t('dest.sub')}</p>
        <Loader loading={list.loading} error={list.error} reload={list.reload}>
          {list.data?.items.length ? <div className="grid grid-4">{list.data.items.map((d) => <DestinationCard key={d.id} d={d} />)}</div> : <Empty>{t('c.none')}</Empty>}
        </Loader>
      </div>
    </>
  );
}

interface DestReview { id: number; rating: number; comment: string; created_at: string; reviewer: string; trip_id: number; trip_title: string }
interface DestDetail {
  destination: Destination; trips: Trip[];
  images: { id: number; path: string; caption: string | null }[];
  reviews: DestReview[]; rating: { avg: number | null; count: number; counts: number[] };
}

export function DestinationDetail() {
  const { id } = useParams(); const { t, lang, money, tx, fmtDate } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api.get<DestDetail>(`/destinations/${id}`), [id]);
  const [photo, setPhoto] = useState<number | null>(null);
  return (
    <div className="container section-tight">
      <p><Link className="see-all" to="/destinations"><Icon name="arrowLeft" size={15} /> {t('nav.destinations')}</Link></p>
      <Loader loading={loading} error={error} reload={reload}>
        {data && (() => {
          const d = data.destination; const rating = data.rating; const images = data.images || [];
          const map = d.latitude != null ? `https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.name + ' Rwanda')}`;
          const open = data.trips.filter((x) => x.is_open); const other = data.trips.filter((x) => !x.is_open);
          // "Good to know": one tip per line, in the current language (falls back to the other one)
          const info = ((lang === 'rw' ? d.info_rw || d.info_en : d.info_en || d.info_rw) || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
          const shown = photo != null ? images[photo] : null;
          return (<>
            <div className="grid grid-2" style={{ alignItems: 'start' }}>
              <div className="card" style={{ overflow: 'hidden' }}><Cover src={d.image_path} srcs={[destImage(d.slug)]} slug={d.categories[0]?.slug || 'nature'} seed={d.id + 3} alt={d.name} /></div>
              <div>
                <h1 style={{ fontSize: '2.2rem' }}>{d.name}</h1>
                <p className="muted meta-line"><Icon name="pin" size={15} />{d.region}{d.is_demo && <> · <span className="pill pill-grey">{t('c.demo')}</span></>}</p>
                {rating.count > 0 && rating.avg != null && (
                  <p><a className="dest-rating-link" href="#reviews"><Stars n={rating.avg} /> <strong>{rating.avg.toFixed(1)}</strong> <span className="muted small">({t('trip.reviews_n', { n: rating.count })})</span></a></p>
                )}
                <p>{lang === 'rw' ? d.description_rw : d.description_en}</p>
                <div className="pills" style={{ marginBottom: 12 }}>{d.categories.map((c) => <span key={c.id} className="pill">{lang === 'rw' ? c.name_rw : c.name_en}</span>)}</div>
                {d.costs.length > 0 && (<div className="card card-pad" style={{ marginBottom: 12 }}><h4>{t('dest.entry_cost')}</h4>
                  {d.costs.map((c, i) => <div key={i} className="small">{tx('cost.' + c.cost_type)}: <strong>{c.amount != null ? money(c.amount) : t('trip.cost_unknown')}</strong> <span className="muted">({tx('src.' + c.source_type)}{c.source_note ? ' – ' + c.source_note : ''})</span></div>)}</div>)}
                <div className="row">
                  <a className="btn btn-ghost" href={map} target="_blank" rel="noreferrer"><Icon name="map" size={16} />{t('dest.map')}</a>
                  {open.length > 0 && <a className="btn" href="#open-trips"><Icon name="calendar" size={16} />{t('dest.open_count', { n: open.length })}</a>}
                </div>
              </div>
            </div>

            {(info.length > 0 || images.length > 0) && (
              <section className="section-tight dest-more">
                {info.length > 0 && (
                  <div className="card card-pad dest-info">
                    <h2>{t('dest.about')}</h2>
                    <ul>{info.map((line, i) => <li key={i}><Icon name="check" size={16} /><span>{line}</span></li>)}</ul>
                  </div>
                )}
                {images.length > 0 && (
                  <div>
                    <h2>{t('dest.gallery')}</h2>
                    <div className="dest-gallery">
                      {images.map((img, i) => (
                        <button key={img.id} type="button" onClick={() => setPhoto(i)} aria-label={t('dest.photo_n', { n: i + 1, total: images.length })}>
                          <img src={img.path} alt={img.caption || d.name} loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section id="open-trips" className="section-tight dest-section">
              <h2>{t('dest.open_now')}{open.length > 0 && <span className="count-badge">{open.length}</span>}</h2>
              {open.length ? <div className="grid grid-cards">{open.map((x) => <TripCard key={x.id} trip={x} />)}</div> : <div className="notice">{t('dest.no_trips')}</div>}
              {other.length > 0 && (<>
                <h3 style={{ marginTop: 28 }}>{t('dest.other_trips')}</h3>
                <div className="grid grid-cards">{other.map((x) => <TripCard key={x.id} trip={x} />)}</div>
              </>)}
            </section>

            <section id="reviews" className="section-tight dest-section">
              <h2>{t('dest.reviews')}</h2>
              <p className="small muted">{t('dest.reviews_note')}</p>
              <div className="dest-reviews">
                <div className="card card-pad rating-summary">
                  {rating.count > 0 && rating.avg != null ? (<>
                    <div className="rating-big">{rating.avg.toFixed(1)}<small>/5</small></div>
                    <Stars n={rating.avg} />
                    <p className="small muted" style={{ margin: '6px 0 14px' }}>{t('dest.based_on', { n: rating.count })}</p>
                    {[5, 4, 3, 2, 1].map((r) => {
                      const n = rating.counts[r - 1]; const pct = Math.round((n / rating.count) * 100);
                      return (<div key={r} className="rating-bar"><span>{r} ★</span><div className="bar" aria-hidden="true"><i style={{ width: pct + '%' }} /></div><span className="muted">{n}</span></div>);
                    })}
                  </>) : (<><div className="rating-big muted">–</div><Stars n={0} /><p className="small muted" style={{ marginBottom: 0 }}>{t('dest.no_ratings')}</p></>)}
                </div>
                <div className="card card-pad">
                  {data.reviews.length ? data.reviews.map((r) => (
                    <div key={r.id} className="review"><Avatar name={r.reviewer} /><div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row spread" style={{ gap: 8 }}><strong>{r.reviewer}</strong><span className="small muted">{fmtDate(r.created_at)}</span></div>
                      <Stars n={r.rating} />
                      <p style={{ margin: '4px 0' }}>{r.comment}</p>
                      <Link className="small see-all" to={`/trips/${r.trip_id}`}>{t('dest.on_trip', { t: r.trip_title })}</Link>
                    </div></div>
                  )) : <p className="muted" style={{ margin: 0 }}>{t('dest.no_reviews')}</p>}
                </div>
              </div>
            </section>

            {shown && photo != null && (
              <Modal wide title={t('dest.photo_n', { n: photo + 1, total: images.length })} onClose={() => setPhoto(null)}>
                <div className="lightbox">
                  <img src={shown.path} alt={shown.caption || d.name} />
                  {shown.caption && <p className="small muted center">{shown.caption}</p>}
                  {images.length > 1 && (
                    <div className="row spread">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto((photo - 1 + images.length) % images.length)}><Icon name="arrowLeft" size={15} />{t('dest.prev')}</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto((photo + 1) % images.length)}>{t('dest.next')}<Icon name="arrowRight" size={15} /></button>
                    </div>
                  )}
                </div>
              </Modal>
            )}
          </>);
        })()}
      </Loader>
    </div>
  );
}
