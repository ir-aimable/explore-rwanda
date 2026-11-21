import { Link } from 'react-router-dom';
import { HeroImage, srcSetFor } from '../../components/Cover';
import { Icon, type IconName } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { ABOUT, DEVELOPER, type Item } from './aboutContent';

function Head({ icon, title, intro, center }: { icon: IconName; title: string; intro?: string; center?: boolean }) {
  return (
    <header className={`ab-head ${center ? 'center' : ''}`}>
      <span className="ab-head-ico"><Icon name={icon} size={20} /></span>
      <h2>{title}</h2>
      {intro && <p className="muted">{intro}</p>}
    </header>
  );
}

function Cards({ items, numbered }: { items: Item[]; numbered?: boolean }) {
  return (
    <ul className="ab-cards">
      {items.map((it, i) => (
        <li key={it.title} className="card ab-card">
          <span className="ab-ico"><Icon name={it.icon} size={22} /></span>
          <h3>{numbered && <span className="ab-num">{i + 1}.</span>} {it.title}</h3>
          <p>{it.text}</p>
        </li>
      ))}
    </ul>
  );
}

export function About() {
  const { lang } = useI18n();
  const c = ABOUT[lang];
  return (
    <div className="about">
      <section className="banner ab-banner">
        <HeroImage src="/images/hero3.webp" slug="hiking" seed={4} />
        <div className="banner-in">
          <span className="t-script kicker">{c.hero.kicker}</span>
          <h1 className="t-poster">{c.hero.title}</h1>
          <p>{c.hero.sub}</p>
        </div>
      </section>

      <nav className="ab-nav" aria-label={c.hero.title}>
        <div className="container">{c.nav.map((n) => <a key={n.id} href={`#${n.id}`}>{n.label}</a>)}</div>
      </nav>

      {/* Who we are */}
      <section id="who" className="container section ab-split">
        <div>
          <Head icon="compass" title={c.who.title} />
          <p className="ab-lead">{c.who.lead}</p>
          {c.who.paras.map((p) => <p key={p}>{p}</p>)}
        </div>
        <aside className="ab-goal">
          <Icon name="flag" size={28} />
          <span className="ab-goal-label">{c.who.goalLabel}</span>
          <p>{c.who.goal}</p>
        </aside>
      </section>

      {/* Our story */}
      <section id="story" className="ab-tint">
        <div className="container section ab-split rev">
          <div>
            <Head icon="history" title={c.story.title} />
            {c.story.paras.map((p) => <p key={p}>{p}</p>)}
            <blockquote className="ab-quote"><Icon name="sparkles" size={26} /><p>{c.story.quote}</p></blockquote>
          </div>
          <figure className="card ab-dev">
            <img src={DEVELOPER.photo} srcSet={srcSetFor(DEVELOPER.photo)} sizes="(min-width: 900px) 420px, 100vw" alt={DEVELOPER.name} loading="lazy" decoding="async" width={1000} height={563} />
            <figcaption>
              <span className="ab-dev-label"><Icon name="user" size={14} /> {c.story.devLabel}</span>
              <strong>{DEVELOPER.name}</strong>
              <span className="muted">{c.story.devRole}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Vision & mission */}
      <section id="vision" className="container section">
        <div className="grid grid-2">
          <article className="ab-vm vision"><span className="ab-ico lg"><Icon name="eye" size={26} /></span><h2>{c.vision.title}</h2><p>{c.vision.text}</p></article>
          <article className="ab-vm mission"><span className="ab-ico lg"><Icon name="flag" size={26} /></span><h2>{c.mission.title}</h2><p>{c.mission.text}</p></article>
        </div>
      </section>

      {/* Problem */}
      <section className="ab-tint">
        <div className="container section">
          <Head icon="help" title={c.problem.title} intro={c.problem.intro} center />
          <Cards items={c.problem.items} />
          <div className="ab-response"><Icon name="checkCircle" size={24} /><p><strong>{c.problem.responseLabel}:</strong> {c.problem.response}</p></div>
        </div>
      </section>

      {/* What we offer */}
      <section id="offer" className="container section">
        <Head icon="grid" title={c.offer.title} intro={c.offer.intro} center />
        <Cards items={c.offer.items} numbered />
      </section>

      {/* How it works */}
      <section id="how" className="ab-tint">
        <div className="container section">
          <Head icon="map" title={c.how.title} intro={c.how.intro} center />
          <ol className="ab-steps">
            {c.how.steps.map((s, i) => (
              <li key={s.title}>
                <span className="ab-step-badge"><Icon name={s.icon} size={22} /><span className="ab-step-n">{i + 1}</span></span>
                <div><h3>{s.title}</h3><p>{s.text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Audience */}
      <section id="audience" className="container section">
        <Head icon="users" title={c.audience.title} intro={c.audience.intro} center />
        <Cards items={c.audience.items} />
      </section>

      {/* Technology */}
      <section className="ab-tint">
        <div className="container section ab-split">
          <div>
            <Head icon="sparkles" title={c.tech.title} />
            {c.tech.paras.map((p) => <p key={p}>{p}</p>)}
            <p>{c.tech.outro}</p>
            <div className="notice notice-green ab-ai-note"><Icon name="shield" size={18} /> <span>{c.tech.aiNote}</span></div>
          </div>
          <div className="card card-pad">
            <p style={{ fontWeight: 600 }}>{c.tech.listIntro}</p>
            <ul className="ab-checks">{c.tech.list.map((l) => <li key={l}><Icon name="check" size={18} /> {l}</li>)}</ul>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="container section">
        <Head icon="shield" title={c.trust.title} intro={c.trust.intro.join(' ')} center />
        <Cards items={c.trust.items} />
        <p className="ab-closing">{c.trust.outro}</p>
      </section>

      {/* Values */}
      <section id="values" className="ab-tint">
        <div className="container section">
          <Head icon="heart" title={c.values.title} center />
          <ul className="ab-values">
            {c.values.items.map((v) => (
              <li key={v.title}><span className="ab-ico"><Icon name={v.icon} size={24} /></span><h3>{v.title}</h3><p>{v.text}</p></li>
            ))}
          </ul>
        </div>
      </section>

      {/* Contribution */}
      <section className="container section">
        <Head icon="globe" title={c.contribution.title} intro={c.contribution.intro} center />
        <Cards items={c.contribution.items} numbered />
        <p className="ab-closing">{c.contribution.outro}</p>
      </section>

      {/* Promise */}
      <section className="ab-promise">
        <div className="container">
          <span className="ab-promise-label"><Icon name="heart" size={16} /> {c.promise.title}</span>
          <p className="ab-promise-big">{c.promise.big}</p>
          <p>{c.promise.text}</p>
          <span className="t-script kicker">{c.promise.tagline}</span>
        </div>
      </section>
    </div>
  );
}
