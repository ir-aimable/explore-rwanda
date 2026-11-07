import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { Destination, Trip } from '../types';
import { Cover } from './Cover';
import { Status } from './ui';

export function TripCard({ trip }: { trip: Trip }) {
  const { t, lang, fmtDate, money } = useI18n();
  return (
    <Link to={`/trips/${trip.id}`} className="card trip-card">
      <Cover src={trip.cover_image} slug={trip.category.slug} seed={trip.id} alt={trip.title}>
        <span className="tag"><Status kind="st" value={trip.effective_status} /></span>
      </Cover>
      <div className="body">
        <div className="pills"><span className="pill pill-gold">{lang === 'rw' ? trip.category.name_rw : trip.category.name_en}</span>{trip.is_demo && <span className="pill pill-grey">{t('c.demo')}</span>}</div>
        <h3>{trip.title}</h3>
        <div className="meta"><span>{trip.destination.name}</span><span>{fmtDate(trip.trip_date)} · {trip.start_time}</span></div>
        <div className="meta"><span>{trip.organizer.display_name}{trip.organizer.verified ? ' ✓' : ''}</span></div>
        <div className="foot">
          <span className="price">{trip.price === 0 ? t('c.free') : money(trip.price)}</span>
          <span className="small muted">{trip.is_open ? (trip.remaining_spaces === 1 ? t('trip.spaces_one') : t('trip.spaces_left', { n: trip.remaining_spaces })) : ''}</span>
        </div>
      </div>
    </Link>
  );
}

export function DestinationCard({ d }: { d: Destination }) {
  const { t, lang } = useI18n();
  const entry = d.costs.find((c) => c.cost_type === 'entry_fee');
  return (
    <Link to={`/destinations/${d.id}`} className="card dest-card">
      <Cover src={d.image_path} slug={d.categories[0]?.slug || 'nature'} seed={d.id + 3} alt={d.name} />
      <div className="body">
        <h3>{d.name}</h3>
        <span className="small muted">{d.region}</span>
        <p className="small" style={{ margin: 0 }}>{lang === 'rw' ? d.description_rw : d.description_en}</p>
        <div className="pills">{d.categories.map((c) => <span key={c.id} className="pill">{lang === 'rw' ? c.name_rw : c.name_en}</span>)}</div>
        <div className="small muted">
          {entry && entry.amount != null && entry.source_type !== 'unknown' ? `${t('dest.entry_cost')}: RWF ${entry.amount.toLocaleString('en-US')}` : ''}
          {d.available_trips > 0 && <strong> {t('dest.open_trips', { n: d.available_trips })}</strong>}
        </div>
      </div>
    </Link>
  );
}
