import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DestinationCard, TripCard } from '../../components/Cards';
import { Cover, HeroImage, destImage } from '../../components/Cover';
import { Icon } from '../../components/Icon';
import { Empty, Loader } from '../../components/ui';
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

export function DestinationDetail() {
  const { id } = useParams(); const { t, lang, money, tx } = useI18n();
  const { data, loading, error, reload } = useLoad(() => api.get<{ destination: Destination; trips: Trip[] }>(`/destinations/${id}`), [id]);
  return (
    <div className="container section-tight">
      <p><Link className="see-all" to="/destinations"><Icon name="arrowLeft" size={15} /> {t('nav.destinations')}</Link></p>
      <Loader loading={loading} error={error} reload={reload}>
        {data && (() => {
          const d = data.destination;
          const map = d.latitude != null ? `https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.name + ' Rwanda')}`;
          return (<>
            <div className="grid grid-2" style={{ alignItems: 'start' }}>
              <div className="card" style={{ overflow: 'hidden' }}><Cover src={d.image_path} srcs={[destImage(d.slug)]} slug={d.categories[0]?.slug || 'nature'} seed={d.id + 3} alt={d.name} /></div>
              <div>
                <h1 style={{ fontSize: '2.2rem' }}>{d.name}</h1>
                <p className="muted meta-line"><Icon name="pin" size={15} />{d.region}{d.is_demo && <> · <span className="pill pill-grey">{t('c.demo')}</span></>}</p>
                <p>{lang === 'rw' ? d.description_rw : d.description_en}</p>
                <div className="pills" style={{ marginBottom: 12 }}>{d.categories.map((c) => <span key={c.id} className="pill">{lang === 'rw' ? c.name_rw : c.name_en}</span>)}</div>
                {d.costs.length > 0 && (<div className="card card-pad" style={{ marginBottom: 12 }}><h4>{t('dest.entry_cost')}</h4>
                  {d.costs.map((c, i) => <div key={i} className="small">{tx('cost.' + c.cost_type)}: <strong>{c.amount != null ? money(c.amount) : t('trip.cost_unknown')}</strong> <span className="muted">({tx('src.' + c.source_type)}{c.source_note ? ' – ' + c.source_note : ''})</span></div>)}</div>)}
                <a className="btn btn-ghost" href={map} target="_blank" rel="noreferrer"><Icon name="map" size={16} />{t('dest.map')}</a>
              </div>
            </div>
            <section className="section-tight" style={{ paddingTop: 36 }}>
              <h2>{t('dest.trips_here')}</h2>
              {data.trips.length ? <div className="grid grid-cards">{data.trips.map((x) => <TripCard key={x.id} trip={x} />)}</div> : <div className="notice">{t('dest.no_trips')}</div>}
            </section>
          </>);
        })()}
      </Loader>
    </div>
  );
}
