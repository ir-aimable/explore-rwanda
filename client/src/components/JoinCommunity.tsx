import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

/** "Join the Explore Rwanda community": one card for travellers, one for organizers (home page). */
export function JoinCommunity() {
  const { t } = useI18n();
  return (
    <section id="join" className="container section" aria-labelledby="join-h">
      <header className="ab-head center">
        <span className="ab-head-ico"><Icon name="users" size={20} /></span>
        <h2 id="join-h">{t('join.title')}</h2>
      </header>
      <div className="grid grid-2">
        <article className="card card-pad ab-join">
          <span className="ab-ico lg"><Icon name="mountain" size={26} /></span>
          <h3>{t('join.travellers.title')}</h3><p>{t('join.travellers.text')}</p>
          <div className="row">
            <Link className="btn" to="/destinations"><Icon name="map" size={16} /> {t('join.cta_dest')}</Link>
            <Link className="btn btn-ghost" to="/trips"><Icon name="compass" size={16} /> {t('join.cta_trips')}</Link>
          </div>
        </article>
        <article className="card card-pad ab-join">
          <span className="ab-ico lg gold"><Icon name="flag" size={26} /></span>
          <h3>{t('join.organizers.title')}</h3><p>{t('join.organizers.text')}</p>
          <div className="row"><Link className="btn btn-gold" to="/become-organizer">{t('join.cta_org')} <Icon name="arrowRight" size={16} /></Link></div>
        </article>
      </div>
    </section>
  );
}
