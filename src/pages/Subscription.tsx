import { useEffect, useState } from 'react';
import { AlertCircle, CalendarDays, Check, Crown, LoaderCircle, Mail, Sparkles } from 'lucide-react';
import { api, endpoints, getApiError, getStoredUser } from '../services/api';
import type { PublicPlan, UserSubscription } from '../types';

const SUPPORT_EMAIL = 'kpoviessivivenoucherias@gmail.com';

const planPrice = (plan: PublicPlan) => new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: plan.currency,
  minimumFractionDigits: 2
}).format(plan.price);

const planBullets = (plan: PublicPlan) => {
  const bullets = [
    plan.generation_limit === null
      ? 'Générations illimitées'
      : `${plan.generation_limit} génération${plan.generation_limit > 1 ? 's' : ''}`,
    `Validité : ${plan.duration_days} jours`,
    plan.backup_enabled ? 'Sauvegarde des vidéos activée' : 'Sans sauvegarde'
  ];
  if (plan.retention_minutes === 0) bullets.push('Conservation permanente');
  else if (plan.retention_minutes === 15) bullets.push('Suppression automatique après 15 min');
  else bullets.push(`Conservation : ${plan.retention_minutes} min`);
  bullets.push(plan.video_max_minutes
    ? `Vidéos jusqu'à ${plan.video_max_minutes} min incluses, puis Premium`
    : 'Aucune limite de durée par vidéo');
  return bullets;
};

export default function Subscription() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(() => sessionStorage.getItem('subscription_notice') || '');

  useEffect(() => {
    sessionStorage.removeItem('subscription_notice');
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<UserSubscription>(endpoints.mySubscription),
      api.get<PublicPlan[]>(endpoints.plans)
    ])
      .then(([mine, catalog]) => {
        if (!active) return;
        setSubscription(mine.data);
        setPlans(catalog.data);
      })
      .catch((requestError) => { if (active) setError(getApiError(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const requestMailto = (plan: PublicPlan) => {
    const email = getStoredUser()?.email || '';
    const subject = `Souscription VOSTFR AI — ${plan.name}`;
    const body = `Bonjour,\n\nJe souhaite souscrire à la formule ${plan.name} (${planPrice(plan)}).\nCompte : ${email}\n\nMerci.`;
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (loading) return <div className="subscription-state"><LoaderCircle size={22} className="spin"/> Chargement de vos formules…</div>;
  if (error) return <div className="subscription-state error" role="alert"><AlertCircle size={20}/> {error}</div>;
  if (!subscription) return null;

  const detail = subscription.plan_details;
  const limit = detail.generation_limit;
  const used = subscription.generations_used;
  const progress = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const currentLabel = subscription.subscription_status === 'none'
    ? 'Formule gratuite active'
    : subscription.subscription_status === 'active'
      ? 'Abonnement actif'
      : `Abonnement ${subscription.subscription_status}`;

  return <div className="subscription-page">
    {notice && <p className="subscription-notice" role="alert"><AlertCircle size={16}/> {notice}</p>}
    <section className="panel subscription-current">
      <div className="subscription-current-head">
        <div>
          <p className="eyebrow">VOSTFR AI / MON ABONNEMENT</p>
          <h2>{subscription.plan_name}</h2>
          <p>Faites évoluer votre formule à tout moment selon votre volume de traduction.</p>
        </div>
        <span className={`subscription-status ${subscription.subscription_status === 'active' ? 'active' : ''}`}>{currentLabel}</span>
      </div>

      <div className="subscription-metrics">
        <div><span>Générations utilisées</span><strong>{limit ? `${used} / ${limit}` : `${used} · illimité`}</strong></div>
        <div><span>Durée vidéo incluse</span><strong>{detail.video_max_minutes ? `${detail.video_max_minutes} min puis Premium` : 'Illimitée'}</strong></div>
        <div><span>Sauvegarde</span><strong>{detail.backup_enabled ? 'Activée' : 'Désactivée'}</strong></div>
        <div><span>Fin de validité</span><strong>{subscription.subscription_ends_at ? new Date(subscription.subscription_ends_at).toLocaleDateString('fr-FR') : '—'}</strong></div>
      </div>

      {limit && <div className="subscription-quota">
        <div className="subscription-quota-label"><span>Quota du cycle</span><strong>{progress} %</strong></div>
        <div className="meter"><i style={{ width: `${progress}%` }}/></div>
      </div>}

      {Boolean(detail.video_max_minutes) && <p className="subscription-fairuse">
        <Sparkles size={15}/> Au-delà de {detail.video_max_minutes} minutes par vidéo, passez à une formule Premium : aucune limite de durée ensuite.
      </p>}
    </section>

    <section className="subscription-catalog">
      <div className="subscription-catalog-head">
        <div>
          <p className="eyebrow">LES FORMULES</p>
          <h3>Choisissez votre rythme</h3>
        </div>
        <span><CalendarDays size={15}/> Prix indicatifs en USD</span>
      </div>

      <div className="subscription-grid">
        {plans.map((plan) => {
          const isCurrent = plan.code === subscription.plan;
          const fcfa = Number(plan.features.price_fcfa || 0);
          return <article key={plan.code} className={`subscription-card ${isCurrent ? 'current' : ''} ${plan.code === 'PREMIUM_30_BACKUP' ? 'featured' : ''}`}>
            {plan.code === 'PREMIUM_30_BACKUP' && <span className="subscription-flag">Le plus choisi</span>}
            {isCurrent && <span className="subscription-current-badge"><Check size={12}/> Votre formule</span>}
            <p className="subscription-card-kicker">{String(plan.features.highlight || '')}</p>
            <h4>{plan.name}</h4>
            <p className="subscription-card-desc">{plan.description}</p>
            <div className="subscription-card-price">
              <strong>{planPrice(plan)}</strong>
              <span>{fcfa > 0 ? `≈ ${new Intl.NumberFormat('fr-FR').format(fcfa)} FCFA` : '0 FCFA'}</span>
            </div>
            <ul>{planBullets(plan).map((bullet) => <li key={bullet}><Check size={14}/> {bullet}</li>)}</ul>
            {isCurrent
              ? <button type="button" className="button secondary subscription-cta" disabled>Formule actuelle</button>
              : <a href={requestMailto(plan)} className={`button ${plan.code === 'PREMIUM_30_BACKUP' ? 'primary' : 'secondary'} subscription-cta`}>
                <Mail size={15}/> Demander cette formule
              </a>}
          </article>;
        })}
      </div>
      <p className="subscription-note">
        Le paiement en ligne n’est pas encore connecté. Le bouton ouvre un e-mail pré-rempli pour finaliser la souscription avec l’équipe VOSTFR AI.
      </p>
    </section>

    <section className="panel subscription-help">
      <Crown size={22}/>
      <div>
        <h3>Besoin d’un volume spécifique ?</h3>
        <p>Pour un usage professionnel ou une durée de vidéo supérieure, contactez-nous : nous étudierons une formule adaptée.</p>
      </div>
      <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Demande de formule personnalisée VOSTFR AI')}`} className="button secondary">Nous contacter</a>
    </section>
  </div>;
}
