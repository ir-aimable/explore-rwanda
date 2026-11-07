import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Assistant } from '../../components/Assistant';
import { DestinationCard, TripCard } from '../../components/Cards';
import { Scene } from '../../components/Cover';
import { Empty, Loader } from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { api, qs } from '../../services/api';
import type { Destination, Trip } from '../../types';

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
  const trips = useLoad(() => api.get<{ items: Trip[] }>('/search?all=1&sort=date&lang=rw').then((r: any) => ({ items: (r.trips as Trip[]).filter((x) => x.is_open).slice(0, 6) })), []);
  const go = (e: React.FormEvent) => { e.preventDefault(); nav('/trips' + qs({ q: what, max_price: budget, weekend: when === 'weekend' ? 1 : undefined, date: when === 'date' ? date : undefined })); };
  return (
    <>
      <section className="hero">
        <Scene hero slug="hiking" seed={5} className="hero-scene" />
        <div className="container hero-in">
          <h1>{t('home.title')}</h1>
          <p className="lead">{t('home.sub')}</p>
          <div className="ask">
            <form onSubmit={go}>
              <div className="field"><label htmlFor="h-what">{t('home.search.what')}</label><SearchSuggest id="h-what" value={what} onChange={setWhat} placeholder={t('home.search.what_ph')} /></div>
              <div className="field"><label htmlFor="h-when">{t('home.search.when')}</label>
                <select id="h-when" value={when} onChange={(e) => setWhen(e.target.value)}><option value="any">{t('home.search.any')}</option><option value="weekend">{t('home.search.weekend')}</option><option value="date">{t('home.search.date')}</option></select>
                {when === 'date' && <input type="date" aria-label={t('home.search.date')} value={date} onChange={(e) => setDate(e.target.value)} />}</div>
              <div className="field"><label htmlFor="h-b">{t('home.search.budget')}</label><input id="h-b" inputMode="numeric" pattern="[0-9]*" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))} placeholder="10000" /></div>
              <button className="btn btn-gold">{t('home.search.go')}</button>
            </form>
            <div className="ai-link"><Link to="/planner">{t('home.search.ai')}</Link></div>
          </div>
        </div>
      </section>

      <section className="section container" aria-labelledby="ai-h">
        <div className="section-head"><h2 id="ai-h">{t('home.ai.title')}</h2></div>
        <p className="muted">{t('home.ai.sub')}</p>
        <Assistant />
      </section>

      <section className="section container" style={{ paddingTop: 0 }} aria-labelledby="d-h">
        <div className="section-head"><h2 id="d-h">{t('home.dest.title')}</h2><Link to="/destinations">{t('home.dest.all')}</Link></div>
        <Loader loading={dests.loading} error={dests.error} reload={dests.reload}>
          <div className="grid grid-cards">{dests.data?.items.slice(0, 6).map((d) => <DestinationCard key={d.id} d={d} />)}</div>
        </Loader>
      </section>

      <section className="section container" style={{ paddingTop: 0 }} aria-labelledby="t-h">
        <div className="section-head"><h2 id="t-h">{t('home.trips.title')}</h2><Link to="/trips">{t('home.trips.all')}</Link></div>
        <Loader loading={trips.loading} error={trips.error} reload={trips.reload}>
          {trips.data?.items.length ? <div className="grid grid-cards">{trips.data.items.map((x) => <TripCard key={x.id} trip={x} />)}</div> : <Empty>{t('home.empty_trips')}</Empty>}
        </Loader>
      </section>

      <section className="section container" style={{ paddingTop: 0 }} aria-labelledby="how-h">
        <h2 id="how-h">{t('home.how.title')}</h2>
        <ol className="steps" style={{ margin: 0 }}>
          {[1, 2, 3].map((n) => <li key={n}><h3>{t(`home.how.${n}.t` as any)}</h3><p style={{ margin: 0 }}>{t(`home.how.${n}.d` as any)}</p></li>)}
        </ol>
      </section>

      <section className="section container" style={{ paddingTop: 0 }} aria-labelledby="why-h">
        <h2 id="why-h">{t('home.why.title')}</h2>
        <div className="why">{[1, 2, 3].map((n) => <div key={n}><h3>{t(`home.why.${n}.t` as any)}</h3><p>{t(`home.why.${n}.d` as any)}</p></div>)}</div>
      </section>

      <section className="band section-tight">
        <div className="container" style={{ padding: '28px var(--gutter)' }}>
          <h2>{t('home.org.title')}</h2><p>{t('home.org.d')}</p>
          <Link className="btn btn-gold" to="/become-organizer">{t('home.org.cta')}</Link>
        </div>
      </section>
    </>
  );
}
