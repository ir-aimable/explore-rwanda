import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { Destination, Experience, Trip } from '../types';
import { Cover, destImage } from './Cover';
import { Icon } from './Icon';
import { Stars, Status } from './ui';

export function Rating({ value, count }: { value: number | null; count?: number }) {
  if (!value) return null;
  return <span className="rating"><Icon name="star" size={14} fill />{value.toFixed(1)}{count != null && <small>({count})</small>}</span>;
}

export function TripCard({ trip }: { trip: Trip }) {
  const { t, lang, fmtDate, money } = useI18n();
  const cat = lang === 'rw' ? trip.category.name_rw : trip.category.name_en;
  return (
    <Link to={`/trips/${trip.id}`} className="card trip-card">
      <Cover src={trip.cover_image} srcs={[destImage(trip.destination.slug)]} slug={trip.category.slug} seed={trip.id} alt={trip.title}>
        {trip.effective_status !== 'published' && <span className="tag"><Status kind="st" value={trip.effective_status} /></span>}
      </Cover>
      <div className="body">
        <h3>{trip.title}</h3>
        <div className="sub">{trip.destination.name} · {cat}{trip.is_demo && <> · <span className="muted">{t('c.demo')}</span></>}</div>
        <div className="meta-line"><Icon name="calendar" size={14} />{fmtDate(trip.trip_date)} · {trip.start_time}</div>
        <div className="price-row">
          <span className="price">{trip.price === 0 ? t('c.free') : money(trip.price)}</span>
          {trip.organizer.verified && <span className="pill" title={t('c.verified')}><Icon name="check" size={11} />{trip.organizer.display_name}</span>}
        </div>
        {trip.is_open && <span className="spots"><Icon name="users" size={14} />{trip.remaining_spaces === 1 ? t('trip.spaces_one') : t('trip.spaces_left', { n: trip.remaining_spaces })}</span>}
        <div className="foot">
          {trip.avg_rating ? <Rating value={trip.avg_rating} count={trip.review_count} /> : <span className="small muted">{trip.organizer.verified ? '' : trip.organizer.display_name}</span>}
          <span className="details-link">{t('c.view_details')} <Icon name="arrowRight" size={14} /></span>
        </div>
      </div>
    </Link>
  );
}

export function DestinationCard({ d, compact }: { d: Destination; compact?: boolean }) {
  const { t, lang } = useI18n();
  const cats = d.categories.map((c) => (lang === 'rw' ? c.name_rw : c.name_en)).join(' · ');
  return (
    <Link to={`/destinations/${d.id}`} className="card dest-card">
      <Cover src={d.image_path} srcs={[destImage(d.slug)]} slug={d.categories[0]?.slug || 'nature'} seed={d.id + 3} alt={d.name}>
        {d.is_free && <span className="free-tag" title={t('dest.free_hint')}>{t('dest.free')}</span>}
      </Cover>
      <div className="body">
        <h3>{d.name}</h3>
        <span className="sub">{cats || d.region}</span>
        {!compact && <div className="meta-line"><Icon name="pin" size={14} />{d.region}</div>}
        {d.available_trips > 0 && <span className="spots"><Icon name="mountain" size={14} />{t('dest.open_trips', { n: d.available_trips })}</span>}
      </div>
    </Link>
  );
}

/** Hearted "Things to do" cards, kept in this browser only (a per-visitor convenience; it can come back empty). */
const FAV_KEY = 'er_fav_experiences';
function readFavs(): number[] { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } }
function useFav(id: number) {
  const [on, setOn] = useState(() => readFavs().includes(id));
  const toggle = () => {
    const next = !on; setOn(next);
    try { const cur = readFavs().filter((x) => x !== id); localStorage.setItem(FAV_KEY, JSON.stringify(next ? [...cur, id] : cur)); } catch { /* storage unavailable */ }
  };
  return [on, toggle] as const;
}

/** Numbered "Things to do" card: an activity mapped to a destination. Clicking it opens the destination
 * on its open trips for that activity, where the traveller can register. */
export function ExperienceCard({ e, n }: { e: Experience; n: number }) {
  const { t, lang, money } = useI18n();
  const [fav, toggleFav] = useFav(e.id);
  const title = lang === 'rw' ? e.title_rw : e.title_en;
  const to = e.destination ? `/destinations/${e.destination.id}${e.category ? `?activity=${e.category.slug}` : ''}` : `/trips?q=${encodeURIComponent(e.location)}`;
  const recBy = e.recommended_by.join(', ') + (e.recommendations > e.recommended_by.length ? ` +${e.recommendations - e.recommended_by.length}` : '');
  return (
    <div className="exp-card">
      <Link to={to} className="exp-link">
        <Cover src={e.image_path} srcs={[destImage(e.destination?.slug)]} slug={e.category?.slug || 'nature'} seed={e.id + 7} alt={title}>
          {e.recommendations > 0 && <span className="exp-rec" title={t('exp.recommended_by', { names: recBy })}><Icon name="checkCircle" size={14} />{t('exp.recommended_n', { n: e.recommendations })}</span>}
        </Cover>
        <div className="body">
          <span className="exp-rank" aria-hidden="true">{n}</span>
          <span className="exp-loc">{e.location}</span>
          <h3>{title}</h3>
          {e.avg_rating != null && (
            <div className="exp-stars" aria-label={t('exp.rating_aria', { r: e.avg_rating.toFixed(1), n: e.rating_count })}>
              <span>{e.avg_rating.toFixed(1)}</span><Stars n={e.avg_rating} /><span className="muted">({e.rating_count.toLocaleString('en-US')})</span>
            </div>
          )}
          <div className="exp-price">{e.price_from === 0 ? <b>{t('c.free')}</b> : <>{t('exp.from')} <b>{money(e.price_from)}</b></>}</div>
        </div>
      </Link>
      <button type="button" className={`exp-fav ${fav ? 'on' : ''}`} aria-pressed={fav} aria-label={fav ? t('exp.unsave') : t('exp.save')} onClick={toggleFav}>
        <Icon name="heart" size={18} fill={fav} />
      </button>
    </div>
  );
}
