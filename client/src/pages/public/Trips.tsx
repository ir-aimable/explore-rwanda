import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TripCard } from '../../components/Cards';
import { Empty, Loader } from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useI18n } from '../../i18n';
import { api, qs } from '../../services/api';
import type { Category, Trip } from '../../types';
import { SearchSuggest } from './Home';
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
      <div className="page-head"><div className="container"><h1>{t('trips.title')}</h1><p className="muted" style={{ margin: 0 }}>{t('trips.sub')}</p></div></div>
      <div className="container section-tight">
        <form className="card filters" onSubmit={(e) => { e.preventDefault(); update('q', q); }}>
          <div className="field span-all"><label htmlFor="tq">{t('c.search')}</label>
            <div className="ask-bar"><SearchSuggest id="tq" value={q} onChange={setQ} placeholder={t('trips.search_ph')} /><button className="btn">{t('c.search')}</button></div></div>
          <div className="field"><label htmlFor="tc">{t('trips.activity')}</label>
            <select id="tc" value={get('category')} onChange={(e) => update('category', e.target.value)}><option value="">{t('c.all')}</option>{cats.data?.items.map((c) => <option key={c.id} value={c.slug}>{lang === 'rw' ? c.name_rw : c.name_en}</option>)}</select></div>
          <div className="field"><label htmlFor="tp">{t('trips.max_price')}</label><input id="tp" inputMode="numeric" value={get('max_price')} onChange={(e) => update('max_price', e.target.value.replace(/\D/g, ''))} /></div>
          <div className="field"><label htmlFor="td">{t('trips.date')}</label><input id="td" type="date" value={get('date')} onChange={(e) => update('date', e.target.value)} /></div>
          <div className="field"><label htmlFor="ts">{t('trips.sort')}</label><select id="ts" value={sort} onChange={(e) => setSort(e.target.value)}><option value="date">{t('trips.sort.date')}</option><option value="price_asc">{t('trips.sort.price_asc')}</option><option value="price_desc">{t('trips.sort.price_desc')}</option></select></div>
          <label className="check span-all"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />{t('trips.only_open')}</label>
          {key && <div className="span-all"><button type="button" className="link-btn" onClick={() => { setSp({}); setQ(''); }}>{t('c.clear')}</button></div>}
        </form>
        <Loader loading={res.loading} error={res.error} reload={res.reload}>
          {res.data?.understood?.length > 0 && <div className="understood small"><span className="muted">{t('trips.understood')}:</span>{res.data.understood.map((u: string) => <span key={u} className="pill pill-grey">{u}</span>)}</div>}
          <p className="muted small">{t('trips.results', { n: items.length })}</p>
          {items.length ? <div className="grid grid-cards">{items.map((x) => <TripCard key={x.id} trip={x} />)}</div> : (
            <div className="stack"><Empty>{t('trips.none')}</Empty>
              {res.data?.hints?.length > 0 && <ul className="small">{res.data.hints.map((h: string) => <li key={h}>{h}</li>)}</ul>}
              {res.data?.destinations?.length > 0 && <div className="card card-pad"><h4>{t('trips.suggestions_title')}</h4><div className="pills">{res.data.destinations.map((d: any) => <Link key={d.id} to={d.link} className="pill">{d.name}</Link>)}</div></div>}
            </div>)}
        </Loader>
      </div>
    </>
  );
}
