import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clapperboard,
  Download,
  Languages,
  Mail,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  Wand2
} from 'lucide-react';
import Logo from '../components/Logo';
import AuthModal from '../components/AuthModal';
import { api, endpoints, isAuthenticated } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import type { PublicPlan } from '../types';

const features = [
  {
    icon: UploadCloud,
    title: 'Importez votre vidéo',
    text: 'Glissez un film ou un épisode au format MP4, MKV, MOV ou AVI. Aucune conversion manuelle.'
  },
  {
    icon: Wand2,
    title: 'L’IA transcrit et traduit',
    text: 'La parole est transcrite automatiquement puis traduite en français pour un rendu VOSTFR naturel.'
  },
  {
    icon: Languages,
    title: 'Toutes vos langues',
    text: 'Anglais, japonais, coréen, espagnol, allemand… vos dialogues deviennent accessibles à tous.'
  },
  {
    icon: Download,
    title: 'Export SRT & VTT',
    text: 'Récupérez des sous-titres synchronisés, prêts à être lus sur vos lecteurs préférés.'
  }
];

const steps = [
  { title: 'Déposez votre vidéo', text: 'Choisissez le fichier et la langue d’origine.' },
  { title: 'Laissez l’IA travailler', text: 'Transcription, synchronisation et traduction en un seul passage.' },
  { title: 'Téléchargez vos sous-titres', text: 'Récupérez votre fichier VOSTFR et profitez du film.' }
];

const languages = ['Anglais', 'Japonais', 'Coréen', 'Espagnol', 'Allemand', 'Italien', 'Portugais', 'Chinois'];

const fallbackPlans: PublicPlan[] = [
  {
    id: 1,
    code: 'FREE',
    name: 'Gratuit',
    description: '3 générations par mois, vidéos jusqu’à 2 h 30 incluses.',
    price: 0,
    currency: 'USD',
    duration_days: 30,
    generation_limit: 3,
    video_max_minutes: 150,
    backup_enabled: false,
    retention_minutes: 120,
    features: { price_fcfa: 0, highlight: 'Pour découvrir' }
  },
  {
    id: 2,
    code: 'PREMIUM_15',
    name: 'Premium 15 jours',
    description: '15 générations valables 15 jours, sans limite de durée par vidéo.',
    price: 7.99,
    currency: 'USD',
    duration_days: 15,
    generation_limit: 15,
    video_max_minutes: null,
    backup_enabled: false,
    retention_minutes: 120,
    features: { premium: true, price_fcfa: 4800, highlight: 'Essai premium' }
  },
  {
    id: 3,
    code: 'PREMIUM_30_BACKUP',
    name: 'Premium 30 jours – 30 générations',
    description: '30 générations avec sauvegarde, sans limite de durée par vidéo.',
    price: 19.99,
    currency: 'USD',
    duration_days: 30,
    generation_limit: 30,
    video_max_minutes: null,
    backup_enabled: true,
    retention_minutes: 0,
    features: { premium: true, download: true, price_fcfa: 12000, highlight: 'Le plus choisi' }
  },
  {
    id: 4,
    code: 'PREMIUM_30_UNLIMITED',
    name: 'Premium 30 jours – Illimité',
    description: 'Générations illimitées sans sauvegarde ni limite de durée.',
    price: 29.99,
    currency: 'USD',
    duration_days: 30,
    generation_limit: null,
    video_max_minutes: null,
    backup_enabled: false,
    retention_minutes: 15,
    features: { premium: true, price_fcfa: 18000, highlight: 'Gros volumes' }
  }
];

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

export default function Landing() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const routeMode = location.pathname === '/login'
    ? 'login'
    : location.pathname === '/register'
      ? 'register'
      : null;
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(routeMode);
  const [plans, setPlans] = useState<PublicPlan[]>(fallbackPlans);

  useEffect(() => {
    setAuthMode(routeMode);
  }, [routeMode]);

  useEffect(() => {
    let active = true;
    api.get<PublicPlan[]>(endpoints.plans)
      .then(({ data }) => { if (active && data.length) setPlans(data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authMode && isAuthenticated()) {
      navigate('/dashboard', { replace: true });
    }
  }, [authMode, navigate]);

  const handleTheme = (event: MouseEvent<HTMLButtonElement>) =>
    toggleTheme({ x: event.clientX, y: event.clientY });
  const switchAuth = useCallback((mode: 'login' | 'register') => {
    setAuthMode(mode);
    navigate(mode === 'login' ? '/login' : '/register', { replace: true });
  }, [navigate]);
  const closeAuth = useCallback(() => {
    setAuthMode(null);
    navigate('/');
  }, [navigate]);

  return <div className="landing">
    <header className="landing-header">
      <Link to="/" className="landing-brand" aria-label="VOSTFR AI — accueil"><Logo /></Link>
      <nav className="landing-nav" aria-label="Navigation principale">
        <a href="#fonctionnalites">Fonctionnalités</a>
        <a href="#fonctionnement">Comment ça marche</a>
        <a href="#tarifs">Tarifs</a>
        <a href="#langues">Langues</a>
      </nav>
      <div className="landing-actions">
        <button
          className="icon-btn landing-theme"
          onClick={handleTheme}
          aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
        </button>
        <Link to="/register" className="button primary">Créer un compte</Link>
      </div>
    </header>

    <main className="landing-main">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="kicker"><Sparkles size={15}/> Sous-titres VOSTFR générés par IA</p>
          <h1>Vos films, <span>dans votre langue.</span></h1>
          <p className="landing-lead">
            Importez une vidéo, laissez l’IA transcrire les dialogues et générer des sous-titres
            français synchronisés. Rapide, simple et pensé pour les amoureux du cinéma.
          </p>
          <div className="landing-cta">
            <Link to="/register" className="button primary landing-cta-main">
              Commencer gratuitement <ArrowRight size={17}/>
            </Link>
            <Link to="/login" className="button secondary">
              J’ai déjà un compte
            </Link>
          </div>
          <p className="landing-note">
            <CheckCircle2 size={14}/> Inscription gratuite — aucune carte bancaire requise
          </p>
        </div>

        <div className="landing-preview" aria-hidden="true">
          <div className="landing-preview-head">
            <span className="landing-dot red"/><span className="landing-dot amber"/><span className="landing-dot green"/>
            <span className="landing-file"><Clapperboard size={13}/> une_saison_a_kyoto.mp4</span>
          </div>
          <div className="landing-screen">
            <span className="landing-tag"><Languages size={13}/> Japonais → Français</span>
            <span className="landing-play"><Play size={26} fill="currentColor"/></span>
            <div className="landing-subtitle">
              <p>« On se retrouve ici, comme promis. »</p>
              <span>On se retrouve ici, comme promis.</span>
            </div>
          </div>
          <div className="landing-preview-foot">
            <div className="landing-progress">
              <div className="landing-progress-label"><span>Traduction</span><strong>100 %</strong></div>
              <div className="landing-bar"><i style={{ width: '100%' }}/></div>
            </div>
            <span className="landing-ready"><CheckCircle2 size={15}/> Terminé</span>
          </div>
        </div>
      </section>

      <section className="landing-stats" aria-label="Points forts">
        <div><strong>3 min</strong><span>pour lancer un traitement</span></div>
        <div><strong>+8</strong><span>langues sources prises en charge</span></div>
        <div><strong>SRT / VTT</strong><span>formats de sous-titres exportables</span></div>
        <div><strong>Privé</strong><span>vos vidéos restent dans votre espace</span></div>
      </section>

      <section id="fonctionnalites" className="landing-section">
        <div className="landing-section-head">
          <p className="kicker"><Sparkles size={15}/> Fonctionnalités</p>
          <h2>Tout ce qu’il faut pour sous-titrer, <span>sans effort.</span></h2>
          <p>Un studio de traduction complet qui s’occupe du plus technique pour vous laisser profiter de vos films.</p>
        </div>
        <div className="landing-features">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="landing-feature">
              <span className="landing-feature-icon"><Icon size={22}/></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="fonctionnement" className="landing-section landing-how">
        <div className="landing-section-head">
          <p className="kicker"><Sparkles size={15}/> Comment ça marche</p>
          <h2>Trois étapes, <span>un film accessible.</span></h2>
        </div>
        <ol className="landing-steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="landing-step-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="tarifs" className="landing-section landing-pricing">
        <div className="landing-section-head">
          <p className="kicker"><Sparkles size={15}/> Tarifs</p>
          <h2>Choisissez le rythme <span>qui vous convient.</span></h2>
          <p>Quatre formules, de la découverte gratuite à la génération en gros volume. Les prix sont indicatifs et peuvent évoluer selon le coût réel de génération.</p>
        </div>
        <div className="landing-pricing-grid">
          {plans.map((plan) => {
            const fcfa = Number(plan.features.price_fcfa || 0);
            return <article key={plan.code} className={`landing-plan ${plan.code === 'PREMIUM_30_BACKUP' ? 'featured' : ''}`}>
              {plan.code === 'PREMIUM_30_BACKUP' && <span className="landing-plan-flag">Le plus choisi</span>}
              <p className="landing-plan-kicker">{String(plan.features.highlight || ({ FREE: 'Gratuit', PREMIUM_15: 'Premium', PREMIUM_30_BACKUP: 'Premium', PREMIUM_30_UNLIMITED: 'Premium' } as Record<string, string>)[plan.code] || 'Premium')}</p>
              <h3>{plan.name}</h3>
              <p className="landing-plan-desc">{plan.description}</p>
              <div className="landing-plan-price">
                <strong>{planPrice(plan)}</strong>
                <span>{fcfa > 0 ? `≈ ${new Intl.NumberFormat('fr-FR').format(fcfa)} FCFA` : '0 FCFA'}</span>
              </div>
              <ul>
                {planBullets(plan).map((bullet) => <li key={bullet}><Check size={14}/> {bullet}</li>)}
              </ul>
              <Link to="/register" className={`button ${plan.code === 'PREMIUM_30_BACKUP' ? 'primary' : 'secondary'} landing-plan-cta`}>
                {plan.price === 0 ? 'Commencer gratuitement' : 'Choisir cette formule'}
              </Link>
            </article>;
          })}
        </div>
        <p className="landing-pricing-note">
          La formule gratuite inclut les vidéos jusqu’à 2 h 30. Au-delà, un abonnement Premium est demandé ; ensuite, aucune limite de durée par vidéo n’est appliquée.
        </p>
      </section>

      <section id="langues" className="landing-langs">
        <div>
          <p className="kicker"><Languages size={15}/> Langues</p>
          <h2>Vos histoires parlent déjà <span>toutes les langues.</span></h2>
          <p>Détection automatique de la langue d’origine et traduction fidèle en français, avec des dizaines de combinaisons possibles.</p>
          <div className="landing-chips">
            {languages.map((language) => <span key={language}><Check size={13}/> {language}</span>)}
          </div>
        </div>
        <div className="landing-langs-card">
          <span className="landing-langs-orb"><ShieldCheck size={30}/></span>
          <h3>Un traitement privé</h3>
          <p>Vos fichiers sont traités dans votre espace personnel et restent à l’abri des regards.</p>
          <ul>
            <li><CheckCircle2 size={16}/> Aucun partage public</li>
            <li><CheckCircle2 size={16}/> Suppression à tout moment</li>
            <li><CheckCircle2 size={16}/> Compte personnel sécurisé</li>
          </ul>
        </div>
      </section>

      <section className="landing-final">
        <div>
          <p className="kicker"><Sparkles size={15}/> Prêt à commencer ?</p>
          <h2>Le prochain film, <span>c’est maintenant.</span></h2>
          <p>Créez votre espace gratuit et générez vos premiers sous-titres VOSTFR en quelques minutes.</p>
        </div>
        <Link to="/register" className="button landing-cta-main landing-final-cta">
          Créer mon compte <ArrowRight size={17}/>
        </Link>
      </section>
    </main>

    <footer className="landing-footer">
      <Logo />
      <span>© {new Date().getFullYear()} VOSTFR AI — Tous vos films, dans votre langue.</span>
      <div>
        <a className="landing-email" href="mailto:kpoviessivivenoucherias@gmail.com"><Mail size={14}/> kpoviessivivenoucherias@gmail.com</a>
        <Link to="/login">Connexion</Link>
        <Link to="/register">Inscription</Link>
      </div>
    </footer>

    {authMode && <AuthModal
      mode={authMode}
      onClose={closeAuth}
      onSwitch={switchAuth}
    />}
  </div>;
}
