import { useEffect, useState } from 'react';
import { User, SlidersHorizontal, Bell, ShieldCheck, LoaderCircle } from 'lucide-react';
import { api, endpoints, getApiError, getStoredUser, saveStoredUser } from '../services/api';

export default function Settings() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setFullName(stored.full_name || '');
      setEmail(stored.email || '');
    }
    api.get(endpoints.me).then(({ data }) => {
      setFullName(data.full_name || '');
      setEmail(data.email || '');
      saveStoredUser(data);
    }).catch(() => undefined);
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put(endpoints.updateMe, { full_name: fullName });
      saveStoredUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="page-intro compact"><p className="kicker">VOTRE ESPACE</p><h2>Paramètres</h2><p>Personnalisez votre expérience VOSTFR AI.</p></div>
    <div className="settings-grid">
      <section className="panel settings-nav">
        <div className="setting-nav active"><User size={17}/> Profil</div>
        <div className="setting-nav"><SlidersHorizontal size={17}/> Préférences de traduction</div>
        <div className="setting-nav"><Bell size={17}/> Notifications</div>
        <div className="setting-nav"><ShieldCheck size={17}/> Sécurité du compte</div>
      </section>
      <section className="panel settings-form">
        <h3>Informations personnelles</h3>
        <p className="panel-subtitle">Ces informations sont visibles uniquement par vous.</p>
        <label>Nom complet<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Votre nom"/></label>
        <label>Adresse email<input value={email} type="email" readOnly/></label>
        {error && <p style={{ color: '#ff8298', fontSize: 12 }}>{error}</p>}
        <div className="form-footer">
          <span className="saved"><span className="dot online"/> {saved ? 'Modifications enregistrées' : 'Vos données sont synchronisées avec la base'}</span>
          <button className="button primary" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={16} className="spin"/> : null} Enregistrer</button>
        </div>
      </section>
    </div>
  </>;
}
