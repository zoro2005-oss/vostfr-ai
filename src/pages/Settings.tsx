import { useEffect, useState } from 'react';
import { User, SlidersHorizontal, Bell, ShieldCheck, LoaderCircle } from 'lucide-react';
import { api, endpoints, getApiError, getStoredUser, saveStoredUser } from '../services/api';

type Tab = 'profile' | 'translation' | 'notifications' | 'security';

const tabs: Array<[Tab, string, typeof User]> = [
  ['profile', 'Profil', User],
  ['translation', 'Préférences de traduction', SlidersHorizontal],
  ['notifications', 'Notifications', Bell],
  ['security', 'Sécurité du compte', ShieldCheck]
];

const languages = [
  ['fr', 'Français'],
  ['en', 'Anglais'],
  ['es', 'Espagnol'],
  ['de', 'Allemand'],
  ['it', 'Italien'],
  ['pt', 'Portugais'],
  ['ru', 'Russe'],
  ['ja', 'Japonais'],
  ['ko', 'Coréen'],
  ['zh', 'Chinois'],
  ['ar', 'Arabe']
] as const;

const tones = [
  ['neutral', 'Neutre'],
  ['formal', 'Formel'],
  ['casual', 'Familier']
] as const;

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <span className="switch-control">
    <span className={`switch-label ${checked ? 'on' : 'off'}`}>{checked ? 'Activé' : 'Désactivé'}</span>
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`ios-switch ${checked ? 'on' : ''}`} onClick={onChange}><i/></button>
  </span>;
}

export default function Settings() {
  const [tab, setTab] = useState<Tab>('profile');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [targetLanguage, setTargetLanguage] = useState('fr');
  const [tone, setTone] = useState('neutral');
  const [keepExpressions, setKeepExpressions] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [translationSaving, setTranslationSaving] = useState(false);
  const [translationSaved, setTranslationSaved] = useState(false);
  const [translationError, setTranslationError] = useState('');

  const [emailOnComplete, setEmailOnComplete] = useState(true);
  const [emailOnError, setEmailOnError] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsSaved, setNotificationsSaved] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securitySaved, setSecuritySaved] = useState(false);
  const [securityError, setSecurityError] = useState('');

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

    api.get(endpoints.settings).then(({ data }) => {
      setTargetLanguage(data.preferred_language || 'fr');
      const prefs = data.translation_preferences || {};
      setTone(prefs.tone || 'neutral');
      setKeepExpressions(Boolean(prefs.keep_expressions));
      setAutoSync(prefs.auto_sync !== false);
      const notifications = data.notifications || {};
      setEmailOnComplete(notifications.email_on_complete !== false);
      setEmailOnError(notifications.email_on_error !== false);
      setProductUpdates(Boolean(notifications.product_updates));
    }).catch(() => undefined);
  }, []);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileError('');
    try {
      const { data } = await api.put(endpoints.updateMe, { full_name: fullName });
      saveStoredUser(data);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err) {
      setProfileError(getApiError(err));
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveTranslation() {
    setTranslationSaving(true);
    setTranslationError('');
    try {
      await api.put(endpoints.settings, {
        preferred_language: targetLanguage,
        translation_preferences: {
          default_target_language: targetLanguage,
          tone,
          keep_expressions: keepExpressions,
          auto_sync: autoSync
        }
      });
      setTranslationSaved(true);
      setTimeout(() => setTranslationSaved(false), 2500);
    } catch (err) {
      setTranslationError(getApiError(err));
    } finally {
      setTranslationSaving(false);
    }
  }

  async function saveNotifications() {
    setNotificationsSaving(true);
    setNotificationsError('');
    try {
      await api.put(endpoints.settings, {
        notifications: {
          email_on_complete: emailOnComplete,
          email_on_error: emailOnError,
          product_updates: productUpdates
        }
      });
      setNotificationsSaved(true);
      setTimeout(() => setNotificationsSaved(false), 2500);
    } catch (err) {
      setNotificationsError(getApiError(err));
    } finally {
      setNotificationsSaving(false);
    }
  }

  async function changePassword() {
    setSecurityError('');
    if (newPassword.length < 6) {
      setSecurityError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setSecuritySaving(true);
    try {
      await api.post(endpoints.changePassword, {
        current_password: currentPassword,
        new_password: newPassword
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecuritySaved(true);
      setTimeout(() => setSecuritySaved(false), 2500);
    } catch (err) {
      setSecurityError(getApiError(err));
    } finally {
      setSecuritySaving(false);
    }
  }

  return <>
    <div className="settings-grid">
      <section className="panel settings-nav">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" className={`setting-nav ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={17}/> {label}
          </button>
        ))}
      </section>

      <section className="panel settings-form">
        {tab === 'profile' && <>
          <h3>Informations personnelles</h3>
          <p className="panel-subtitle">Ces informations sont visibles uniquement par vous.</p>
          <label>Nom complet<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Votre nom"/></label>
          <label>Adresse email<input value={email} type="email" readOnly/></label>
          {profileError && <p style={{ color: '#ff8298', fontSize: 12 }}>{profileError}</p>}
          <div className="form-footer">
            <span className="saved"><span className="dot online"/> {profileSaved ? 'Modifications enregistrées' : 'Vos informations sont à jour'}</span>
            <button className="button primary" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? <LoaderCircle size={16} className="spin"/> : null} Enregistrer</button>
          </div>
        </>}

        {tab === 'translation' && <>
          <h3>Préférences de traduction</h3>
          <p className="panel-subtitle">Choisissez les réglages appliqués par défaut à vos nouveaux projets.</p>
          <div className="settings-list">
            <div className="setting-row">
              <label htmlFor="default-target-language">Langue cible par défaut</label>
              <select id="default-target-language" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                {languages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
            <div className="setting-row">
              <label htmlFor="translation-tone">Ton de traduction</label>
              <select id="translation-tone" value={tone} onChange={(event) => setTone(event.target.value)}>
                {tones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="setting-row">
              <span className="setting-name">Conserver les expressions originales</span>
              <Switch checked={keepExpressions} onChange={() => setKeepExpressions((value) => !value)} label="Conserver les expressions originales" />
            </div>
            <div className="setting-row">
              <span className="setting-name">Synchronisation automatique</span>
              <Switch checked={autoSync} onChange={() => setAutoSync((value) => !value)} label="Synchronisation automatique" />
            </div>
          </div>
          {translationError && <p style={{ color: '#ff8298', fontSize: 12 }}>{translationError}</p>}
          <div className="form-footer">
            <span className="saved"><span className="dot online"/> {translationSaved ? 'Préférences enregistrées' : 'Ces réglages seront appliqués par défaut'}</span>
            <button className="button primary" onClick={saveTranslation} disabled={translationSaving}>{translationSaving ? <LoaderCircle size={16} className="spin"/> : null} Enregistrer</button>
          </div>
        </>}

        {tab === 'notifications' && <>
          <h3>Notifications</h3>
          <p className="panel-subtitle">Choisissez les emails que vous souhaitez recevoir.</p>
          <div className="settings-list">
            <div className="setting-row">
              <span className="setting-name">Email à la fin d’une traduction</span>
              <Switch checked={emailOnComplete} onChange={() => setEmailOnComplete((value) => !value)} label="Email à la fin d’une traduction" />
            </div>
            <div className="setting-row">
              <span className="setting-name">Email en cas d’erreur de traitement</span>
              <Switch checked={emailOnError} onChange={() => setEmailOnError((value) => !value)} label="Email en cas d’erreur de traitement" />
            </div>
            <div className="setting-row">
              <span className="setting-name">Nouveautés et offres VOSTFR AI</span>
              <Switch checked={productUpdates} onChange={() => setProductUpdates((value) => !value)} label="Nouveautés et offres VOSTFR AI" />
            </div>
          </div>
          {notificationsError && <p style={{ color: '#ff8298', fontSize: 12 }}>{notificationsError}</p>}
          <div className="form-footer">
            <span className="saved"><span className="dot online"/> {notificationsSaved ? 'Notifications enregistrées' : 'Vos préférences de notification'}</span>
            <button className="button primary" onClick={saveNotifications} disabled={notificationsSaving}>{notificationsSaving ? <LoaderCircle size={16} className="spin"/> : null} Enregistrer</button>
          </div>
        </>}

        {tab === 'security' && <>
          <h3>Sécurité du compte</h3>
          <p className="panel-subtitle">Modifiez votre mot de passe pour protéger votre compte.</p>
          <label>Adresse email<input value={email} type="email" readOnly/></label>
          <label>Mot de passe actuel<input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Votre mot de passe actuel"/></label>
          <label>Nouveau mot de passe<input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="Au moins 6 caractères"/></label>
          <label>Confirmer le nouveau mot de passe<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="Répétez le nouveau mot de passe"/></label>
          {securityError && <p style={{ color: '#ff8298', fontSize: 12 }}>{securityError}</p>}
          <div className="form-footer">
            <span className="saved"><span className="dot online"/> {securitySaved ? 'Mot de passe mis à jour' : 'Votre mot de passe reste confidentiel'}</span>
            <button className="button primary" onClick={changePassword} disabled={securitySaving || !currentPassword || !newPassword || !confirmPassword}>{securitySaving ? <LoaderCircle size={16} className="spin"/> : null} Modifier le mot de passe</button>
          </div>
        </>}
      </section>
    </div>
  </>;
}
