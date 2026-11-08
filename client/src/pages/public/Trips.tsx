import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TripCard } from '../../components/Cards';
import { Empty, Loader } from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { api, qs } from '../../services/api';
import type { Category, Trip } from '../../types';
import { SearchSuggest } from './Home';
import { HeroImage } from '../../components/Cover';
import { Icon } from '../../components/Icon';
import { Link } from 'react-router-dom';

export default function Trips() {
  const { t, lang } = useI18n(); const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const get = (k: string) => sp.get(k) || '';
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [sort, setSort] = useState('date');
  const cats = useLoad(() => api.get<{ items: Category[] }>('/categories'), []);
  useEffect(() => { setQ(sp.get('q') || ''); }, [sp]);
  const key = sp.toString();
  const res = useLoad(() => api.get<any>(`/search${qs({ q: get('q'), category: get('category'), max_price: get('max_price'), date: get('date'), weekend: get('weekend'), location: get('location'), all: 1, sort, lang })}`), [key, sort, lang]);
  const update = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k === 'date') n.delete('weekend'); setSp(n, { replace: true }); };
  const items: Trip[] = (res.data?.trips || []).filter((x: Trip) => !onlyOpen || x.is_open);
  return (
    <>
      <section className="banner">
        <HeroImage src="/images/trips-hero.jpg" slug="wildlife" seed={3} />
        <div className="banner-in" style={{ paddingBottom: 128 }}>
          <span className="t-script kicker">{t('poster.trips.top')}</span>
          <h1 className="t-poster">{t('trips.title')}</h1>
          <p>{t('trips.hero_sub')}</p>
        </div>
      </section>
      <div className="container">
        <form className="card filter-bar overlap" onSubmit={(e) => { e.preventDefault(); update('q', q); }} role="search">
          <div className="fb-q"><Icon name="search" /><label htmlFor="tq" className="sr-only">{t('c.search')}</label><SearchSuggest id="tq" value={q} onChange={setQ} placeholder={t('trips.search_ph')} /></div>
          <select aria-label={t('trips.activity')} value={get('category')} onChange={(e) => update('category', e.target.value)}><option value="">{t('c.all')} · {t('trips.activity')}</option>{cats.data?.items.map((c) => <option key={c.id} value={c.slug}>{lang === 'rw' ? c.name_rw : c.name_en}</option>)}</select>
          <input className="fb-price" aria-label={t('trips.max_price')} placeholder={t('trips.max_price')} inputMode="numeric" value={get('max_price')} onChange={(e) => update('max_price', e.target.value.replace(/\D/g, ''))} />
          <input type="date" aria-label={t('trips.date')} value={get('date')} onChange={(e) => update('date', e.target.value)} />
          <button className="btn">{t('c.search')}</button>
        </form>
        <div className="filter-extra">
          <label className="check"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />{t('trips.only_open')}</label>
          <div className="row" style={{ gap: 8 }}>
            {key && <button type="button" className="link-btn small" onClick={() => { setSp({}); setQ(''); }}>{t('c.clear')}</button>}
            <select style={{ width: 'auto', minHeight: 38, borderRadius: 999 }} aria-label={t('trips.sort')} value={sort} onChange={(e) => setSort(e.target.value)}><option value="date">{t('trips.sort.date')}</option><option value="price_asc">{t('trips.sort.price_asc')}</option><option value="price_desc">{t('trips.sort.price_desc')}</option></select>
          </div>
        </div>
        <Loader loading={res.loading} error={res.error} reload={res.reload}>
          {res.data?.understood?.length > 0 && <div className="understood small"><span className="muted">{t('trips.understood')}:</span>{res.data.understood.map((u: string) => <span key={u} className="pill pill-grey">{u}</span>)}</div>}
          <p className="muted small">{t('trips.results', { n: items.length })}</p>
          {items.length ? <div className="grid grid-cards" style={{ paddingBottom: 40 }}>{items.map((x) => <TripCard key={x.id} trip={x} />)}</div> : (
            <div className="stack" style={{ paddingBottom: 40 }}><Empty>{t('trips.none')}</Empty>
              {res.data?.hints?.length > 0 && <ul className="small">{res.data.hints.map((h: string) => <li key={h}>{h}</li>)}</ul>}
              {res.data?.destinations?.length > 0 && <div className="card card-pad"><h4>{t('trips.suggestions_title')}</h4><div className="pills">{res.data.destinations.map((d: any) => <Link key={d.id} to={d.link} className="pill">{d.name}</Link>)}</div></div>}
            </div>)}
        </Loader>
      </div>
    </>
  );
}
