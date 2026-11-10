// Conversational state for one planning session. A new message either updates the active search
// (keeping every other criterion) or starts a new request. Short, ambiguous replies get one targeted question.
// Pure functions (no DB access) so they are unit-testable.
import { norm, type DateRange, type Intent } from './nlp.js';

export type PrefKey = 'category' | 'location' | 'origin' | 'budget' | 'budgetType' | 'date' | 'people' | 'transportIncluded';
export const PREFS: PrefKey[] = ['category', 'location', 'origin', 'budget', 'budgetType', 'date', 'people', 'transportIncluded'];

/** Question waiting for an answer from the previous reply. */
export type Pending =
  | { kind: 'place_role'; place: string }  // "Musanze": destination or starting location?
  | { kind: 'origin' };                     // "Change starting location": where from?

export interface Session {
  category?: string; location?: string; origin?: string;
  budget?: number; budgetType?: 'total' | 'activity';
  date?: DateRange; people?: number; transportIncluded?: boolean;
  lastRequest?: string;      // the last message that ran a search
  lastTripIds?: number[];    // trips returned by that search
  lastNearbyIds?: number[];  // closest options already offered (so a follow-up does not repeat the full pitch)
  pending?: Pending;
}

export interface Turn {
  intent: Intent;
  /** 'update' keeps the remembered criteria; 'new' starts over (keeping only the starting location). */
  mode: 'fresh' | 'update' | 'new' | 'reset';
  changed: PrefKey[];
  cleared: PrefKey[];
  /** Set when the message must be clarified before searching. */
  ask?: Pending;
  answered?: Pending['kind'];
}

const tokens = (s: string) => norm(s).replace(/[^a-z0-9' ]+/g, ' ').replace(/'/g, ' ').replace(/\s+/g, ' ').trim();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const title = (s: string) => s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
export const hasSearch = (s?: Session) => !!s && PREFS.some((k) => s[k] !== undefined);

export function isReset(text: string) {
  return /\b(start over|start again|new search|new plan|reset|forget (that|everything|all)|something else entirely|tangira bushya|dutangire bushya|ongera utangire)\b/.test(tokens(text));
}

/** "any date", "no budget", "anywhere"… removes one criterion. */
export function detectClears(text: string): PrefKey[] {
  const t = tokens(text);
  const d = '(?:any|no|without|remove|forget|drop|ignore|clear)(?: the| a| my)?';
  const out: PrefKey[] = [];
  if (new RegExp(`\\b${d} (budget|price limit|price)\\b|\\bnta ngengo\\b`).test(t)) out.push('budget', 'budgetType');
  if (new RegExp(`\\b${d} (date|day)\\b|\\bany ?time\\b|\\bwhenever\\b`).test(t)) out.push('date');
  if (new RegExp(`\\b${d} (place|destination|location)\\b|\\banywhere\\b|\\bahantu hose\\b`).test(t)) out.push('location');
  if (new RegExp(`\\b${d} (activity|activities)\\b|\\bany activity\\b`).test(t)) out.push('category');
  if (new RegExp(`\\b${d} transport\\b|\\btransport (does not|doesn t) matter\\b`).test(t)) out.push('transportIncluded');
  return out;
}

/** "Change starting location" (quick reply or typed) without naming the new place. */
export function asksOriginChange(text: string, i: Intent) {
  return !i.origin && /\b(change|set|update|different|another) (my |the )?(starting (location|point)|origin|departure)\b|\bhindura aho (nturuka|mva)\b/.test(tokens(text));
}

function answerPending(text: string, p: Pending, cur: Intent): { origin?: string; location?: string } | undefined {
  const t = tokens(text);
  if (p.kind === 'place_role') {
    if (/\b(destination|going (to|there)|go there|visit|trips? to|aho njya|aho ngiye|ahantu njya)\b/.test(t) || /^(to|the first|first|1)\b/.test(t)) return { location: p.place };
    if (/\b(starting|start|origin|from|departure|leaving|i m (in|at)|i am (in|at)|aho nturuka|nturuka|mvuye|second|2)\b/.test(t)) return { origin: p.place };
    return undefined;
  }
  // kind === 'origin'
  if (cur.origin) return { origin: cur.origin };
  if (cur.location && !cur.category) return { origin: cur.location };
  const m = t.match(/^(?:(?:i m|im|i am|from|in|at|kuva|i|mu|ndi)\s+)*([a-z][a-z ]{1,30})$/);
  if (m && cur.detected.length === 0 && !cur.social.length && m[1].split(' ').length <= 3) return { origin: title(m[1].trim()) };
  return undefined;
}

/** Decide how this message relates to the remembered session. */
export function applySession(cur: Intent, prev?: Session): Turn {
  const turn: Turn = { intent: cur, mode: 'fresh', changed: [], cleared: [] };
  if (cur.action === 'blocked_action' || cur.action === 'blocked_private') return turn;
  if (isReset(cur.raw)) { turn.mode = 'reset'; return turn; }
  if (!prev) return turn;
  const i: Intent = { ...cur, detected: [...cur.detected], social: [...cur.social] };

  // 1) Answer to the question asked in the previous reply
  if (prev.pending) {
    const a = answerPending(cur.raw, prev.pending, cur);
    if (a) {
      turn.answered = prev.pending.kind;
      if (a.origin) { i.origin = a.origin; if (i.location && norm(i.location) === norm(a.origin)) i.location = undefined; }
      if (a.location) i.location = a.location;
      i.action = 'search'; i.social = i.social.filter((s) => s !== 'affirm');
    }
  }

  // 2) Clears ("any date") and explicit origin-change requests are updates to the active search
  // "Any ideas?" during an active search means: show me options for THIS search.
  if (i.action === 'recommend' && hasSearch(prev)) i.action = 'search';
  turn.cleared = detectClears(cur.raw);
  if (turn.cleared.length && i.action !== 'search' && hasSearch(prev)) i.action = 'search';
  if (!turn.answered && asksOriginChange(cur.raw, cur) && hasSearch(prev)) { turn.ask = { kind: 'origin' }; turn.mode = 'update'; i.action = 'search'; }
  if (i.action !== 'search') { turn.intent = i; return turn; }
  if (!hasSearch(prev)) { turn.intent = i; return turn; }

  // 3) New request or update? A complete new request (activity + two more criteria) starts over;
  //    anything shorter refines the active search.
  const explicit = PREFS.filter((k) => (cur as any)[k] !== undefined);
  const looksNew = !turn.answered && !!cur.category && cur.category !== prev.category && explicit.length >= 3;
  if (looksNew) { turn.mode = 'new'; if (!i.origin && prev.origin) i.origin = prev.origin; turn.intent = i; return turn; }
  turn.mode = 'update';

  // 4) A bare place name ("Musanze") is ambiguous once a search is active: destination or starting point?
  const barePlace = !turn.answered && cur.location && cur.placeRole === 'bare' && !cur.category && cur.budget === undefined && !cur.date && !cur.people && tokens(cur.raw).split(' ').length <= 3;
  if (barePlace && norm(cur.location!) !== norm(prev.location || '') && norm(cur.location!) !== norm(prev.origin || '')) {
    turn.ask = { kind: 'place_role', place: cur.location! };
    i.location = undefined;
  }

  for (const k of PREFS) {
    const now = (i as any)[k], before = (prev as any)[k];
    if (turn.cleared.includes(k)) { (i as any)[k] = undefined; continue; }
    if (now === undefined && before !== undefined) { (i as any)[k] = before; i.detected.push(`${k}_ctx`); }
    else if (now !== undefined && before !== undefined && !same(now, before)) turn.changed.push(k);
    else if (now !== undefined && before === undefined && k !== 'budgetType') turn.changed.push(k);
  }
  if (i.budget === undefined) i.budgetType = undefined;
  turn.intent = i;
  return turn;
}

export function toSession(i: Partial<Intent>, extra: Partial<Session> = {}): Session {
  const s: Session = {};
  for (const k of PREFS) if ((i as any)[k] !== undefined) (s as any)[k] = (i as any)[k];
  return { ...s, ...extra };
}
