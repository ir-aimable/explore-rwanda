import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { Destination, Trip } from '../types';
import { Cover, destImage } from './Cover';
import { Icon } from './Icon';
import { Status } from './ui';

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
      <Cover src={d.image_path} srcs={[destImage(d.slug)]} slug={d.categories[0]?.slug || 'nature'} seed={d.id + 3} alt={d.name} />
      <div className="body">
        <h3>{d.name}</h3>
        <span className="sub">{cats || d.region}</span>
        {!compact && <div className="meta-line"><Icon name="pin" size={14} />{d.region}</div>}
        {d.available_trips > 0 && <span className="spots"><Icon name="mountain" size={14} />{t('dest.open_trips', { n: d.available_trips })}</span>}
      </div>
    </Link>
  );
}
