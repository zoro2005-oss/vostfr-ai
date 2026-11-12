import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LoaderCircle, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import Logo from '../components/Logo';
import { api, endpoints, getApiError, saveSession } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('vostfr_token')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(endpoints.login, { email, password });
      saveSession(data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return <div className="auth-page">
    <aside className="auth-art">
      <Logo />
      <div className="art-copy">
        <p className="kicker"><Sparkles size={15}/> VOSTFR AI</p>
        <h1>Vos films, <span>dans toutes les langues.</span></h1>
        <p>Importez une vidéo, laissez l’IA transcrire les dialogues et retrouvez vos sous-titres traduits dans votre espace.</p>
      </div>
      <div className="art-foot"><span><ShieldCheck size={13}/> Traitement privé</span><span>© VOSTFR AI</span></div>
    </aside>
    <main className="auth-form">
      <div className="auth-box">
        <div className="auth-mobile-logo"><Logo /></div>
        <h2>Connexion</h2>
        <p className="auth-sub">Connectez-vous pour accéder à vos traductions.</p>
        <form onSubmit={submit}>
          <label>Adresse email
            <div className="input-icon"><Mail size={16}/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" required /></div>
          </label>
          <label>Mot de passe
            <div className="input-icon"><Lock size={16}/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" required /></div>
          </label>
          {error && <p style={{ color: '#ff8298', fontSize: 12, margin: '0 0 14px' }}>{error}</p>}
          <button className="button primary full" disabled={loading}>
            {loading ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>} Se connecter
          </button>
        </form>
        <p className="auth-switch">Pas encore de compte ? <Link to="/register">Créer un compte</Link></p>
        <p className="muted" style={{ fontSize: 10, textAlign: 'center', marginTop: 18 }}>Compte démo : demo@vostfr.ai / demo1234</p>
      </div>
    </main>
  </div>;
}
