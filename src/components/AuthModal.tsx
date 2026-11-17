import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Lock, Mail, ShieldCheck, User, X } from 'lucide-react';
import Logo from './Logo';
import { api, endpoints, getApiError, saveSession } from '../services/api';
import { usePreloader } from '../contexts/PreloaderContext';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  onSwitch: (mode: AuthMode) => void;
}

export default function AuthModal({ mode, onClose, onSwitch }: AuthModalProps) {
  const navigate = useNavigate();
  const { show } = usePreloader();
  const isLogin = mode === 'login';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  useEffect(() => {
    setError('');
    setLoading(false);
    setForgot(false);
    setForgotSent(false);
    setResetUrl('');
  }, [mode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const changeMode = (next: AuthMode) => {
    setForgot(false);
    setForgotSent(false);
    setResetUrl('');
    onSwitch(next);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (forgot) {
      setLoading(true);
      try {
        const { data } = await api.post(endpoints.forgotPassword, { email });
        setForgotSent(true);
        setResetUrl(typeof data?.reset_url === 'string' ? data.reset_url : '');
      } catch (err) {
        setError(getApiError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!isLogin && password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const { data } = isLogin
        ? await api.post(endpoints.login, { email, password })
        : await api.post(endpoints.register, {
            full_name: fullName || undefined,
            email,
            password
          });
      saveSession(data);
      show(1600);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return <div
    className="auth-modal-backdrop"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div className="auth-box auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="auth-modal-head">
        <Logo />
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Fermer">
          <X size={18}/>
        </button>
      </div>

      <div className="auth-modal-tabs" role="tablist" aria-label="Connexion ou inscription">
        <button
          type="button"
          role="tab"
          aria-selected={isLogin && !forgot}
          className={isLogin && !forgot ? 'active' : ''}
          onClick={() => changeMode('login')}
        >
          Connexion
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isLogin && !forgot}
          className={!isLogin && !forgot ? 'active' : ''}
          onClick={() => changeMode('register')}
        >
          Créer un compte
        </button>
      </div>

      {forgot ? (
        forgotSent ? (
          <>
            <span className="auth-success-icon"><CheckCircle2 size={26}/></span>
            <h2 id="auth-modal-title">Email envoyé</h2>
            <p className="auth-sub">
              Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
              Pensez à vérifier vos spams.
            </p>
            {resetUrl && <a href={resetUrl} className="button primary full auth-reset-link">
              Ouvrir le lien de réinitialisation <ArrowRight size={17}/>
            </a>}
            <button
              type="button"
              className="button secondary full auth-back-button"
              onClick={() => { setForgot(false); setForgotSent(false); setResetUrl(''); }}
            >
              <ArrowLeft size={16}/> Retour à la connexion
            </button>
          </>
        ) : (
          <>
            <h2 id="auth-modal-title">Mot de passe oublié</h2>
            <p className="auth-sub">Entrez votre adresse email, nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
            <form onSubmit={submit}>
              <label>Adresse email
                <div className="input-icon"><Mail size={16}/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" autoComplete="email" required/></div>
              </label>
              {error && <p className="auth-error">{error}</p>}
              <button className="button primary full" disabled={loading}>
                {loading ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>}
                Envoyer le lien
              </button>
              <button type="button" className="auth-back-link" onClick={() => { setForgot(false); setError(''); }}>
                <ArrowLeft size={15}/> Retour à la connexion
              </button>
            </form>
          </>
        )
      ) : (
        <>
          <h2 id="auth-modal-title">{isLogin ? 'Connexion' : 'Créer un compte'}</h2>
          <p className="auth-sub">
            {isLogin
              ? 'Connectez-vous pour accéder à vos traductions.'
              : 'Votre espace de traduction personnel, gratuit.'}
          </p>

          <form onSubmit={submit}>
            {!isLogin && <label>Nom complet
              <div className="input-icon"><User size={16}/><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Votre nom" autoComplete="name"/></div>
            </label>}
            <label>Adresse email
              <div className="input-icon"><Mail size={16}/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" autoComplete="email" required/></div>
            </label>
            <label>Mot de passe
              <div className="input-icon"><Lock size={16}/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isLogin ? 'Votre mot de passe' : '6 caractères minimum'} autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? undefined : 6} required/></div>
            </label>
            {isLogin && <div className="auth-forgot-row">
              <button type="button" className="auth-forgot-link" onClick={() => { setForgot(true); setError(''); }}>
                Mot de passe oublié ?
              </button>
            </div>}
            {!isLogin && <label>Confirmer le mot de passe
              <div className="input-icon"><Lock size={16}/><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Répétez le mot de passe" autoComplete="new-password" minLength={6} required/></div>
            </label>}
            {error && <p className="auth-error">{error}</p>}
            <button className="button primary full" disabled={loading}>
              {loading ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>}
              {isLogin ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </form>

          <p className="auth-switch">
            {isLogin ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
            <button type="button" onClick={() => changeMode(isLogin ? 'register' : 'login')}>
              {isLogin ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>

          <div className="auth-modal-foot">
            <span><ShieldCheck size={12}/> Connexion sécurisée — vos données restent privées</span>
          </div>
        </>
      )}
    </div>
  </div>;
}
