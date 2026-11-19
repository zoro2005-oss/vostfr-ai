import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, LoaderCircle, Lock, Mail, ShieldCheck } from 'lucide-react';
import { adminApi, getApiError } from './api';
import { getStoredUser, saveSession } from '../src/services/api';
import type { AdminMe } from './types';

type AdminLoginResponse = {
  access_token: string;
  token_type?: string;
  user: { id: number; email: string; full_name?: string; role: string };
};

export default function AdminAccess({ onSuccess }: { onSuccess: (admin: AdminMe) => void }) {
  const stored = getStoredUser();
  const [email, setEmail] = useState(stored?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await adminApi.post<AdminLoginResponse>('/login', { email, password });
      saveSession({
        access_token: session.access_token,
        token_type: session.token_type,
        user: session.user,
      });
      const me = await adminApi.get<AdminMe>('/me');
      onSuccess(me);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  return <div className="admin-access">
    <div className="admin-access-card">
      <span className="admin-access-badge"><ShieldCheck size={26}/></span>
      <p className="eyebrow">VOSTFR AI / ACCÈS ADMIN</p>
      <h1>Validation administrateur</h1>
      <p className="admin-access-intro">
        Ce formulaire est réservé aux comptes administrateurs. Vos identifiants sont vérifiés côté serveur avant l’ouverture des pages de gestion.
      </p>

      <form className="admin-access-form" onSubmit={submit}>
        <label className="admin-field">
          <span>Adresse e-mail</span>
          <span className="admin-access-input">
            <Mail size={16}/>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@vostfr.ai" autoComplete="username" required/>
          </span>
        </label>
        <label className="admin-field">
          <span>Mot de passe</span>
          <span className="admin-access-input">
            <Lock size={16}/>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Votre mot de passe" autoComplete="current-password" required/>
          </span>
        </label>

        {error && <div className="admin-access-error" role="alert"><AlertCircle size={16}/>{error}</div>}

        <button type="submit" className="button primary" disabled={loading}>
          {loading ? <><LoaderCircle size={16} className="spin"/> Vérification…</> : <><ShieldCheck size={16}/> Accéder à l’administration</>}
        </button>
      </form>

      <div className="admin-access-foot">
        <Link to="/dashboard"><ArrowLeft size={14}/> Espace utilisateur</Link>
        <Link to="/">Accueil</Link>
      </div>
    </div>
  </div>;
}
