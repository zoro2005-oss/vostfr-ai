import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, LoaderCircle, Lock, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import { api, endpoints, getApiError } from '../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => navigate('/login', { replace: true }), 3000);
    return () => window.clearTimeout(timer);
  }, [done, navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await api.post(endpoints.resetPassword, { token, password });
      setDone(true);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return <div className="reset-page">
    <div className="reset-box">
      <Logo />

      {!token ? (
        <>
          <h1>Lien invalide</h1>
          <p>Ce lien de réinitialisation est incomplet ou a expiré. Demandez-en un nouveau depuis la page de connexion.</p>
          <Link to="/login" className="button primary full">Retour à la connexion</Link>
        </>
      ) : done ? (
        <>
          <span className="reset-success-icon"><CheckCircle2 size={28}/></span>
          <h1>Mot de passe mis à jour</h1>
          <p>Votre nouveau mot de passe est enregistré. Redirection vers la page de connexion…</p>
          <Link to="/login" className="button primary full">Se connecter <ArrowRight size={17}/></Link>
        </>
      ) : (
        <>
          <p className="kicker"><ShieldCheck size={15}/> Sécurité</p>
          <h1>Nouveau mot de passe</h1>
          <p>Choisissez un nouveau mot de passe pour votre compte VOSTFR AI.</p>
          <form onSubmit={submit}>
            <label>Nouveau mot de passe
              <div className="input-icon"><Lock size={16}/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 caractères minimum" autoComplete="new-password" minLength={6} required/></div>
            </label>
            <label>Confirmer le mot de passe
              <div className="input-icon"><Lock size={16}/><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Répétez le mot de passe" autoComplete="new-password" minLength={6} required/></div>
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button className="button primary full" disabled={loading}>
              {loading ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>}
              Mettre à jour le mot de passe
            </button>
          </form>
          <p className="auth-switch"><Link to="/login">Retour à la connexion</Link></p>
        </>
      )}
    </div>
  </div>;
}
