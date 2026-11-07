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
