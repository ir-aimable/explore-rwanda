import { useState } from 'react';

const PALETTE: Record<string, { sky: [string, string]; far: string; mid: string; near: string; sun: string }> = {
  hiking: { sky: ['#f6ecd2', '#e4efe8'], far: '#8fb09b', mid: '#4f7f65', near: '#1f4d3a', sun: '#c9a24a' },
  nature: { sky: ['#eef3e6', '#dbe9dd'], far: '#9bbb98', mid: '#5d8a62', near: '#2b5b3d', sun: '#d8b960' },
  swimming: { sky: ['#e8f1ef', '#cfe3df'], far: '#8bb5ad', mid: '#4f8c88', near: '#2b6a6a', sun: '#e0c36d' },
  boating: { sky: ['#e8f1ef', '#d4e6e2'], far: '#7fa9a6', mid: '#3f7f80', near: '#245a5e', sun: '#e0c36d' },
  wildlife: { sky: ['#f8e9c4', '#f1d9a0'], far: '#cfa65b', mid: '#a67c3a', near: '#6e5326', sun: '#e6bd5a' },
  culture: { sky: ['#f4e6d0', '#ead3b2'], far: '#c19a72', mid: '#9a7350', near: '#6a4b32', sun: '#d7a94b' },
  waterfall: { sky: ['#e5eee9', '#d1e2da'], far: '#86ad9c', mid: '#477a69', near: '#1f4d3a', sun: '#d8b960' },
  cycling: { sky: ['#f6ecd2', '#e4efe8'], far: '#9fb88c', mid: '#668f58', near: '#2f5f3a', sun: '#c9a24a' },
};

function ridge(seed: number, base: number, amp: number, peaks: number, w = 400) {
  let d = `M0 ${base}`;
  for (let i = 0; i <= peaks * 2; i++) {
    const x = (i / (peaks * 2)) * w;
    const r = Math.sin(seed * 12.9898 + i * 78.233 + base) * 43758.5453; const f = r - Math.floor(r);
    const y = base - (i % 2 ? amp * (0.45 + f * 0.55) : amp * 0.1 * f);
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + ` L${w} 250 L0 250 Z`;
}

export function Scene({ slug = 'hiking', seed = 1, className, hero }: { slug?: string; seed?: number; className?: string; hero?: boolean }) {
  const p = hero ? { sky: ['#153a2b', '#153a2b'] as [string, string], far: '#1f4d3a', mid: '#2a5e47', near: '#347055', sun: '#c9a24a' } : (PALETTE[slug] || PALETTE.hiking); const id = `g${slug}${seed}`;
  const water = slug === 'swimming' || slug === 'boating';
  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true" className={className}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.sky[0]} /><stop offset="1" stopColor={p.sky[1]} /></linearGradient></defs>
      {!hero && <rect width="400" height="250" fill={`url(#${id})`} />}
      {!hero && <circle cx={80 + (seed * 53) % 240} cy="62" r="22" fill={p.sun} opacity=".9" />}
      <path d={ridge(seed, 150, 80, 3)} fill={p.far} />
      <path d={ridge(seed + 3, 185, 70, 4)} fill={p.mid} />
      {water ? (<g><rect y="196" width="400" height="54" fill={p.near} />{[0, 1, 2, 3].map((i) => <path key={i} d={`M${20 + i * 90} ${210 + (i % 2) * 14} q15 -7 30 0 t30 0`} stroke="#ffffff" strokeOpacity=".55" strokeWidth="2" fill="none" />)}</g>)
        : <path d={ridge(seed + 7, 225, 55, 5)} fill={p.near} />}
      {slug === 'wildlife' && <g fill={p.near}><rect x="300" y="150" width="3" height="40" /><path d="M280 152h46c-6-12-40-12-46 0z" /></g>}
      {(slug === 'nature' || slug === 'cycling') && <g fill={p.near}>{[40, 70, 330, 360].map((x, i) => <path key={x} d={`M${x} ${215 - i % 2 * 6} l10 -34 l10 34z`} />)}</g>}
    </svg>
  );
}

/** Image slot: tries each candidate URL in order; if none loads it shows the illustrated
 * placeholder scene. In development a small label tells you which file to add. */
export function Cover({ src, srcs, slug, seed = 1, alt = '', children, className, hint }: {
  src?: string | null; srcs?: (string | null | undefined)[]; slug?: string; seed?: number; alt?: string; children?: React.ReactNode; className?: string; hint?: string;
}) {
  const list = [src, ...(srcs || [])].filter((x): x is string => !!x);
  const [idx, setIdx] = useState(0);
  const cur = list[idx];
  const want = hint || [...list].reverse().find((x) => x.startsWith('/images/'));
  return (
    <div className={`cover ${className || ''}`}>
      {cur ? <img key={cur} src={cur} alt={alt} loading="lazy" onError={() => setIdx((i) => i + 1)} /> : <Scene slug={slug} seed={seed} />}
      {!cur && import.meta.env.DEV && want && <span className="img-hint" title="Drop an image at this path in client/public">+ {want}</span>}
      {children}
    </div>
  );
}

/** Full-bleed background image for hero banners, with a gradient + scene fallback. */
export function HeroImage({ src, slug = 'hiking', seed = 5 }: { src: string; slug?: string; seed?: number }) {
  const [ok, setOk] = useState(true);
  return (
    <div className="hero-bg" aria-hidden="true">
      {ok ? <img src={src} alt="" onError={() => setOk(false)} /> : <><Scene slug={slug} seed={seed} />{import.meta.env.DEV && <span className="img-hint">+ {src}</span>}</>}
    </div>
  );
}

export const destImage = (slug?: string) => (slug ? `/images/destinations/${slug}.jpg` : undefined);
