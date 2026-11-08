import { env } from '../../config/env.js';

/** OPTIONAL: asks a local Ollama model to phrase the intro sentence. Facts are passed in and the model never
 *  changes recommendations. Any failure returns null and the rule-based sentence is used. */
export async function rephrase(base: string, facts: unknown, lang: 'rw' | 'en'): Promise<string | null> {
  if (!env.ollamaUrl) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`${env.ollamaUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.ollamaModel, stream: false,
        prompt: `Rewrite this one sentence for a tourism app user in ${lang === 'rw' ? 'Kinyarwanda' : 'English'}. ` +
          `Use ONLY the facts given. Do not add trips, prices, dates or places. Max 2 sentences.\nSentence: ${base}\nFacts: ${JSON.stringify(facts).slice(0, 1500)}`,
      }),
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j: any = await r.json();
    const out = String(j.response || '').trim();
    return out && out.length < 400 ? out : null;
  } catch { return null; }
}

/** OPTIONAL: a short, friendly reply to a message the rules did not understand. The model is told it
 *  knows no trips, prices or dates, so it can only chat and steer the user back to trip planning. */
export async function chatReply(message: string, lang: 'rw' | 'en'): Promise<string | null> {
  if (!env.ollamaUrl) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(`${env.ollamaUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.ollamaModel, stream: false,
        prompt: `You are the friendly Explore Rwanda Assistant inside a Rwandan tourism app. Reply in ${lang === 'rw' ? 'Kinyarwanda' : 'English'}, warmly, in at most 2 short sentences. ` +
          'You do not know any specific trips, prices, dates or availability, so never mention any. Answer the user briefly if it is harmless small talk, then invite them to tell you an activity, place, date or budget so you can find open trips.\n' +
          `User: ${message.slice(0, 400)}`,
      }),
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j: any = await r.json();
    const out = String(j.response || '').trim();
    return out && out.length < 400 && !/\d{3,}|rwf|frw/i.test(out) ? out : null;
  } catch { return null; }
}
