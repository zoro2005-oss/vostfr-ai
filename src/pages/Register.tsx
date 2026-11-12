import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LoaderCircle, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react';
import Logo from '../components/Logo';
import { api, endpoints, getApiError, saveSession } from '../services/api';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(endpoints.register, {
        full_name: fullName || undefined,
        email,
        password
      });
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
        <h1>Créez vos sous-titres <span>en quelques minutes.</span></h1>
        <p>Un compte suffit pour importer vos vidéos, suivre vos traitements et retrouver tous vos fichiers de sous-titres.</p>
      </div>
      <div className="art-foot"><span><ShieldCheck size={13}/> Traitement privé</span><span>© VOSTFR AI</span></div>
    </aside>
    <main className="auth-form">
      <div className="auth-box">
        <div className="auth-mobile-logo"><Logo /></div>
        <h2>Créer un compte</h2>
        <p className="auth-sub">Votre espace de traduction personnel.</p>
        <form onSubmit={submit}>
          <label>Nom complet
            <div className="input-icon"><User size={16}/><input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Votre nom" /></div>
          </label>
          <label>Adresse email
            <div className="input-icon"><Mail size={16}/><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.com" required /></div>
          </label>
          <label>Mot de passe
            <div className="input-icon"><Lock size={16}/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 caractères minimum" minLength={6} required /></div>
          </label>
          <label>Confirmer le mot de passe
            <div className="input-icon"><Lock size={16}/><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Répétez le mot de passe" minLength={6} required /></div>
          </label>
          {error && <p style={{ color: '#ff8298', fontSize: 12, margin: '0 0 14px' }}>{error}</p>}
          <button className="button primary full" disabled={loading}>
            {loading ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>} Créer mon compte
          </button>
        </form>
        <p className="auth-switch">Déjà inscrit ? <Link to="/login">Se connecter</Link></p>
      </div>
    </main>
  </div>;
}
