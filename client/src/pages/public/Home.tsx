import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Assistant } from '../../components/Assistant';
import { DestinationCard, TripCard } from '../../components/Cards';
import { HeroImage } from '../../components/Cover';
import { Icon, Robot } from '../../components/Icon';
import { Empty, Loader } from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { api, qs } from '../../services/api';
import type { Category, Destination, Trip } from '../../types';

export function SearchSuggest({ value, onChange, id, placeholder }: { value: string; onChange: (v: string) => void; id: string; placeholder?: string }) {
  const { lang } = useI18n(); const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    if (value.trim().length < 2) { setItems([]); return; }
    const h = setTimeout(() => api.get(`/search/suggest${qs({ q: value, lang })}`).then((r) => setItems(r.items.map((i: any) => i.value))).catch(() => setItems([])), 220);
    return () => clearTimeout(h);
  }, [value, lang]);
  return (<><input id={id} list={id + '-l'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />
    <datalist id={id + '-l'}>{[...new Set(items)].map((i) => <option key={i} value={i} />)}</datalist></>);
}

export default function Home() {
  const { t } = useI18n(); const nav = useNavigate();
  const [what, setWhat] = useState(''); const [when, setWhen] = useState('any'); const [date, setDate] = useState(''); const [budget, setBudget] = useState('');
  const dests = useLoad(() => api.get<{ items: Destination[] }>('/destinations'), []);
  const cats = useLoad(() => api.get<{ items: Category[] }>('/categories'), []);
  const trips = useLoad(() => api.get<{ items: Trip[] }>('/search?all=1&sort=date&lang=rw').then((r: any) => { const open = (r.trips as Trip[]).filter((x) => x.is_open); return { items: open.slice(0, 6), total: open.length }; }), []);
  const go = (e: React.FormEvent) => { e.preventDefault(); nav('/trips' + qs({ q: what, max_price: budget, weekend: when === 'weekend' ? 1 : undefined, date: when === 'date' ? date : undefined })); };
  const n = (v?: number) => (v == null ? '–' : String(v));
  return (
    <>
      <section className="hero">
        <HeroImage src="/images/hero.jpg" slug="hiking" seed={5} />
        <div className="container hero-in">
          <h1 className="poster-title"><span className="t-script">{t('poster.hero.top')}</span><span className="t-poster">{t('poster.hero.big')}</span><span className="t-script">{t('poster.hero.bottom')}</span></h1>
          <p className="lead">{t('home.sub')}</p>
          <form className="searchbar" onSubmit={go} role="search">
            <div className="sb-q"><Icon name="search" /><label htmlFor="h-what" className="sr-only">{t('home.search.what')}</label>
              <SearchSuggest id="h-what" value={what} onChange={setWhat} placeholder={t('home.search.q_ph')} /></div>
            <select aria-label={t('home.search.when')} value={when} onChange={(e) => setWhen(e.target.value)}>
              <option value="any">{t('home.search.any')}</option><option value="weekend">{t('home.search.weekend')}</option><option value="date">{t('home.search.date')}</option></select>
            {when === 'date' && <input className="sb-date" type="date" aria-label={t('home.search.date')} value={date} onChange={(e) => setDate(e.target.value)} />}
            <input className="sb-budget" aria-label={t('home.search.budget')} inputMode="numeric" pattern="[0-9]*" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} placeholder={t('home.search.budget_ph')} />
            <button className="btn">{t('c.search')}</button>
          </form>
          <Link className="btn btn-gold btn-ai" to="/planner"><Robot size={30} small />{t('home.cta_ai')}</Link>
        </div>
      </section>

      <div className="container">
        <div className="card stat-strip overlap">
          <div><span className="ic"><Icon name="pin" size={22} /></span><div><b>{n(dests.data?.items.length)}</b><span>{t('home.stat.dest')}</span></div></div>
          <div><span className="ic gold"><Icon name="calendar" size={22} /></span><div><b>{n(trips.data?.total)}</b><span>{t('home.stat.trips')}</span></div></div>
          <div><span className="ic"><Icon name="mountain" size={22} /></span><div><b>{n(cats.data?.items.length)}</b><span>{t('home.stat.cats')}</span></div></div>
          <div><span className="ic gold"><Icon name="heart" size={22} /></span><div><b>100%</b><span>{t('home.stat.pride')}</span></div></div>
        </div>
      </div>

      <section className="section container" aria-labelledby="d-h">
        <div className="section-head"><h2 id="d-h">{t('home.dest.title')}</h2><Link className="see-all" to="/destinations">{t('home.dest.all')} <Icon name="arrowRight" size={15} /></Link></div>
        <Loader loading={dests.loading} error={dests.error} reload={dests.reload}>
          <div className="grid grid-4">{dests.data?.items.slice(0, 4).map((d) => <DestinationCard key={d.id} d={d} compact />)}</div>
        </Loader>
      </section>

      <section className="section container" style={{ paddingTop: 0 }} aria-labelledby="t-h">
        <div className="section-head"><h2 id="t-h">{t('home.trips.title')}</h2><Link className="see-all" to="/trips">{t('home.trips.all')} <Icon name="arrowRight" size={15} /></Link></div>
        <Loader loading={trips.loading} error={trips.error} reload={trips.reload}>
          {trips.data?.items.length ? <div className="grid grid-cards">{trips.data.items.map((x) => <TripCard key={x.id} trip={x} />)}</div> : <Empty>{t('home.empty_trips')}</Empty>}
        </Loader>
      </section>

      <section className="section container" style={{ paddingTop: 0 }} aria-labelledby="ai-h">
        <div className="section-head"><div><h2 id="ai-h">{t('home.ai.title')}</h2><p className="muted" style={{ margin: '6px 0 0' }}>{t('home.ai.sub')}</p></div></div>
        <Assistant />
      </section>

      <section className="section container" style={{ paddingTop: 0 }} aria-labelledby="how-h">
        <h2 id="how-h">{t('home.how.title')}</h2>
        <ol className="steps">
          {[1, 2, 3].map((k) => <li key={k}><h3>{t(`home.how.${k}.t` as any)}</h3><p className="muted" style={{ margin: 0 }}>{t(`home.how.${k}.d` as any)}</p></li>)}
        </ol>
      </section>

      <section className="section container" style={{ paddingTop: 0 }} aria-labelledby="why-h">
        <h2 id="why-h">{t('home.why.title')}</h2>
        <div className="why">{([[1, 'checkCircle'], [2, 'wallet'], [3, 'shield']] as const).map(([k, ic]) => <div key={k}><span className="ic"><Icon name={ic} size={22} /></span><div><h3>{t(`home.why.${k}.t` as any)}</h3><p>{t(`home.why.${k}.d` as any)}</p></div></div>)}</div>
      </section>

      <section className="container" style={{ paddingBottom: 20 }}>
        <div className="band">
          <div><span className="t-script kicker">{t('poster.org.top')}</span><h2 className="t-poster-sm">{t('home.org.title')}</h2><p>{t('home.org.d')}</p></div>
          <Link className="btn btn-gold" to="/become-organizer">{t('home.org.cta')} <Icon name="arrowRight" size={16} /></Link>
        </div>
      </section>
    </>
  );
}
