import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../services/api';
import type { AssistantReply, Rec } from '../types';
import { Cover } from './Cover';
import { Icon, Robot } from './Icon';
import { Spinner } from './ui';

interface Turn { role: 'user' | 'bot'; text?: string; reply?: AssistantReply; error?: boolean }

const REC_PILL: Record<Rec['recommendationStatus'], string> = { recommended: '', recommended_unconfirmed: 'pill-orange', alternative_above_budget: 'pill-red', not_bookable: 'pill-grey' };

/** Known price, then each extra cost as known / included / unknown. Unknown costs are never shown as zero. */
function CostLines({ r }: { r: Rec }) {
  const { t, tx, money } = useI18n();
  const c = r.cost;
  return (
    <table className="cost-lines small"><tbody>
      <tr><td>{t('cost.activity_price')}</td><td>{money(c.activity_price)}</td></tr>
      {c.lines.map((l, i) => {
        const e = l.estimate;
        if (l.status === 'estimated' && e) return (
          <tr key={i} className="estimated">
            <td>{tx('cost.' + l.type, l.type)} · {t('cost.est_from', { p: e.from })}{e.via ? ` ${t('cost.est_via', { p: e.via })}` : ''}
              <span className="muted"> · {e.basis === 'table' ? t('cost.est_table') : t('cost.est_distance', { km: e.km ?? '?' })}</span>
              {e.instead_of && <div className="muted">{t('cost.est_instead', { p: e.instead_of.start, n: money(e.instead_of.amount) })}</div>}</td>
            <td>≈ {money(l.amount!)}</td>
          </tr>);
        return (
        <tr key={i} className={l.status === 'unknown' ? 'unknown' : ''}>
          <td>{l.label || tx('cost.' + l.type, l.type)}{l.source_type && l.status === 'known' ? <span className="muted"> · {tx('src.' + l.source_type)}</span> : null}</td>
          <td>{l.status === 'unknown' ? t('cost.unknown') : l.status === 'included' ? t('cost.included') : money(l.amount!)}</td>
        </tr>);
      })}
      <tr className="total"><td colSpan={2}>{c.complete ? <>{c.estimated ? t('cost.total_estimated') : t('cost.total_known')}: <b>{c.estimated ? '≈ ' : ''}{money(c.known_total)}</b></>
        : <><b>{t('cost.total_unconfirmed')}</b> <span className="muted">{t('cost.known_so_far', { n: money(c.known_total) })}</span></>}</td></tr>
    </tbody></table>
  );
}

function RecCard({ r }: { r: Rec }) {
  const { t, lang, fmtDate, money, tx } = useI18n();
  return (
    <div className={`rec ${r.alternative ? 'alt' : ''}`}>
      <Cover src={r.cover_image} slug={r.category_slug} seed={r.id} alt="" />
      <div style={{ minWidth: 0 }}>
        <h4>{r.title}</h4>
        <div className="meta-line"><Icon name="pin" size={13} />{r.destination} · {lang === 'rw' ? r.category_name_rw : r.category_name_en}</div>
        <div className="meta-line"><Icon name="calendar" size={13} />{fmtDate(r.trip_date)} · {r.start_time}</div>
        <div className="meta-line"><Icon name="users" size={13} />{r.remaining_spaces === 1 ? t('trip.spaces_one') : t('trip.spaces_left', { n: r.remaining_spaces })} · {r.organizer}{r.verified ? ' ✓' : ''}</div>
        <div className="pills" style={{ marginTop: 6 }}>
          <span className={`pill ${REC_PILL[r.recommendationStatus]}`}>{t(r.recommendationStatus === 'recommended' && r.cost.estimated ? 'rs.recommended_est' : `rs.${r.recommendationStatus}` as any)}</span>
          {r.tripAvailabilityStatus !== 'available' && <span className="pill pill-grey">{t(`ta.${r.tripAvailabilityStatus}` as any)}</span>}
          {r.over_budget_by != null && <span className="pill pill-red">{t('trips.over_by', { n: r.over_budget_by.toLocaleString('en-US') })}</span>}
        </div>
        {r.reasons.length > 0 && <ul>{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        <CostLines r={r} />
      </div>
      <div className="rec-side">
        <span className="price-tag">{r.price === 0 ? t('c.free') : money(r.price)}</span>
        <Link className="btn btn-sm" to={r.link}>{t('ai.view_trip')} <Icon name="arrowRight" size={14} /></Link>
      </div>
    </div>
  );
}

function BotFace() { return <span className="bot-face"><Robot size={34} small /></span>; }

export function Assistant({ initial, examples = true }: { initial?: string; examples?: boolean }) {
  const { t, lang } = useI18n();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ctx = useRef<any>(undefined);
  const [plan, setPlan] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  async function ask(q: string) {
    const msg = q.trim(); if (!msg || busy) return;
    setTurns((s) => [...s, { role: 'user', text: msg }]); setText(''); setBusy(true);
    try {
      const r = await api.post<AssistantReply>('/search/assistant', { message: msg, lang, context: ctx.current });
      ctx.current = r.context; if (r.plan) setPlan(r.plan); setTurns((s) => [...s, { role: 'bot', reply: r }]);
    } catch { setTurns((s) => [...s, { role: 'bot', text: t('err.generic'), error: true }]); }
    setBusy(false);
  }
  useEffect(() => { if (initial && !started.current) { started.current = true; ask(initial); } /* eslint-disable-next-line */ }, [initial]);
  useEffect(() => { if (turns.length > 1) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [turns]);

  const exs = [t('ai.ex1'), t('ai.ex2'), t('ai.ex3'), t('ai.ex4'), t('ai.ex5'), t('ai.ex6')];
  return (
    <div className="ai-shell">
      <div className="ai-panel">
        <Robot size={170} />
        <h2>{t('ai.panel_title')}</h2>
        <p>{t('ai.panel_sub')}</p>
        <ul>
          <li><Icon name="sparkles" />{t('ai.panel.1')}</li>
          <li><Icon name="checkCircle" />{t('ai.panel.2')}</li>
          <li><Icon name="wallet" />{t('ai.panel.3')}</li>
        </ul>
        <button className="btn btn-outline-light" onClick={() => ask(exs[0])} disabled={busy}>{t('ai.try')}</button>
      </div>
      <div className="ai-main">
        {plan.length > 0 && (
          <div className="plan-bar">
            <div className="understood small" style={{ margin: 0 }}><span className="muted">{t('ai.plan')}:</span>{plan.map((u) => <span key={u} className="pill pill-grey">{u}</span>)}</div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { ctx.current = undefined; setPlan([]); setTurns([]); }}>{t('ai.start_over')}</button>
          </div>
        )}
        <div className="chat-log stack" aria-live="polite" style={{ flex: 1 }}>
          <div className="msg-row"><BotFace /><div className="msg msg-bot"><p style={{ margin: 0 }}>{t('ai.hello')}</p>
            {examples && turns.length === 0 && (<div style={{ marginTop: 12 }}><div className="small muted" style={{ marginBottom: 6 }}>{t('ai.examples')}</div><div className="chips">{exs.map((x) => <button key={x} className="chip" onClick={() => ask(x)}>{x}</button>)}</div></div>)}
          </div></div>
          {turns.map((m, i) => m.role === 'user' ? <div key={i} className="msg-row me"><div className="msg msg-user">{m.text}</div></div> : (
            <div key={i} className="msg-row"><BotFace /><div className="msg msg-bot">
              {m.text && <p style={{ margin: 0 }}>{m.text}</p>}
              {m.reply && (<>
                <p style={{ margin: 0 }}><strong>{m.reply.message}</strong></p>
                {m.reply.understood.length > 0 && <div className="understood small" style={{ marginTop: 8 }}><span className="muted">{t('ai.understood')}:</span>{m.reply.understood.map((u) => <span key={u} className="pill pill-grey">{u}</span>)}</div>}
                {m.reply.clarification && <div className="chips" style={{ marginTop: 8 }}>{m.reply.clarification.options.map((o) => <button key={o} className="chip" disabled={busy || i !== turns.length - 1} onClick={() => ask(o)}>{o}</button>)}</div>}
                {m.reply.trips.map((r) => <RecCard key={r.id} r={r} />)}
                {(m.reply.nearby?.length ?? 0) > 0 && <><p className="small" style={{ marginTop: 12, marginBottom: 0 }}><strong>{m.reply.nearby_title}</strong></p>{m.reply.nearby!.map((r) => <RecCard key={'n' + r.id} r={r} />)}</>}
                {m.reply.alternatives.length > 0 && <><p className="small" style={{ marginTop: 12, marginBottom: 0 }}><strong>{m.reply.alternatives_title}</strong></p>{m.reply.alternatives.map((r) => <RecCard key={'a' + r.id} r={r} />)}</>}
                {(m.reply.unavailable?.length ?? 0) > 0 && <><p className="small" style={{ marginTop: 12, marginBottom: 0 }}><strong>{m.reply.unavailable_title}</strong></p>{m.reply.unavailable!.map((r) => <RecCard key={'u' + r.id} r={r} />)}</>}
                {m.reply.hints.length > 0 && <ul className="small">{m.reply.hints.map((h) => <li key={h}>{h}</li>)}</ul>}
                {!m.reply.clarification && m.reply.suggestions && m.reply.suggestions.length > 0 && <div className="chips" style={{ marginTop: 10 }}>{m.reply.suggestions.map((o) => <button key={o} className="chip" disabled={busy || i !== turns.length - 1} onClick={() => ask(o)}>{o}</button>)}</div>}
                {m.reply.engine === 'rules+ollama' && <div className="small muted" style={{ marginTop: 6 }}>{t('ai.engine_ollama')}</div>}
              </>)}
            </div></div>))}
          {busy && <div className="msg-row"><BotFace /><div className="msg msg-bot row"><Spinner /><span className="small muted">{t('ai.thinking')}</span></div></div>}
          <div ref={endRef} />
        </div>
        <form className="ask-bar" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
          <label className="sr-only" htmlFor="ai-q">{t('ai.title')}</label>
          <input id="ai-q" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ai.placeholder')} maxLength={500} autoComplete="off" />
          <button className="icon-btn" disabled={busy || !text.trim()} aria-label={t('ai.send')}><Icon name="send" size={17} /></button>
        </form>
        <p className="small muted" style={{ margin: 0 }}>{t('ai.footer')}</p>
      </div>
    </div>
  );
}
