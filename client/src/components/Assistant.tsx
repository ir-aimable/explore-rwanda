import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { api } from '../services/api';
import type { AssistantReply, Rec } from '../types';
import { Cover } from './Cover';
import { Icon, Robot } from './Icon';
import { Spinner } from './ui';

interface Turn { role: 'user' | 'bot'; text?: string; reply?: AssistantReply; error?: boolean }

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
        {r.alternative && r.over_budget_by != null && <span className="pill pill-red" style={{ marginTop: 6 }}>{t('trips.over_by', { n: r.over_budget_by.toLocaleString('en-US') })}</span>}
        {r.reasons.length > 0 && <ul>{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        {r.extra_costs.length > 0 && (
          <div className="small muted" style={{ marginTop: 4 }}>{t('ai.cost_extra')}: {r.extra_costs.map((c, i) => <span key={i}>{i ? '; ' : ''}{tx('cost.' + c.cost_type, c.cost_type)} {c.amount != null ? money(c.amount) : t('trip.cost_unknown')} ({tx('src.' + c.source_type)})</span>)}</div>
        )}
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
  const ctx = useRef<unknown>(undefined);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  async function ask(q: string) {
    const msg = q.trim(); if (!msg || busy) return;
    setTurns((s) => [...s, { role: 'user', text: msg }]); setText(''); setBusy(true);
    try {
      const r = await api.post<AssistantReply>('/search/assistant', { message: msg, lang, context: ctx.current });
      ctx.current = r.context; setTurns((s) => [...s, { role: 'bot', reply: r }]);
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
                {m.reply.clarification && <div className="chips" style={{ marginTop: 8 }}>{m.reply.clarification.options.map((o) => <button key={o} className="chip" disabled={busy} onClick={() => ask(o)}>{o}</button>)}</div>}
                {m.reply.trips.map((r) => <RecCard key={r.id} r={r} />)}
                {m.reply.alternatives.length > 0 && <><p className="small" style={{ marginTop: 12, marginBottom: 0 }}><strong>{m.reply.alternatives_title}</strong></p>{m.reply.alternatives.map((r) => <RecCard key={'a' + r.id} r={r} />)}</>}
                {m.reply.hints.length > 0 && <ul className="small">{m.reply.hints.map((h) => <li key={h}>{h}</li>)}</ul>}
                {m.reply.destinations.length > 0 && (<div style={{ marginTop: 10 }}><div className="notice small">{m.reply.destinations_note}</div>
                  <div className="pills" style={{ marginTop: 8 }}>{m.reply.destinations.map((d) => <Link key={d.id} className="pill" to={d.link}>{d.name}</Link>)}</div></div>)}
                {!m.reply.clarification && m.reply.suggestions && m.reply.suggestions.length > 0 && <div className="chips" style={{ marginTop: 10 }}>{m.reply.suggestions.map((o) => <button key={o} className="chip" disabled={busy} onClick={() => ask(o)}>{o}</button>)}</div>}
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
