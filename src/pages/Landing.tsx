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
import { isAuthenticated } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

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

  useEffect(() => {
    setAuthMode(routeMode);
  }, [routeMode]);

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
