import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UploadCloud, FileVideo, X, ArrowRight, Info, Sparkles, LoaderCircle } from 'lucide-react';
import { api, endpoints, getApiError } from '../services/api';
import { projectName } from '../utils/slug';

const languages = [
  ['auto', 'Détection automatique'],
  ['en', 'Anglais'],
  ['fr', 'Français'],
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

export default function NewTranslation() {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [source, setSource] = useState('auto');
  const [target, setTarget] = useState('fr');
  const [manual, setManual] = useState(false);
  const [syncAuto, setSyncAuto] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.get(endpoints.settings).then(({ data }) => {
      if (!active) return;
      const preferred = data?.preferred_language;
      if (typeof preferred === 'string' && languages.some(([code]) => code === preferred && code !== 'auto')) {
        setTarget(preferred);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const choose = (selected?: File) => {
    if (!selected) return;
    if (['video/mp4', 'video/x-matroska', 'video/avi', 'video/quicktime', 'video/webm'].includes(selected.type) || selected.name.match(/\.(mp4|mkv|avi|mov|webm)$/i)) {
      setFile(selected);
      setError('');
    } else {
      setError('Format non supporté. Utilisez MP4, MKV, AVI, MOV ou WEBM.');
    }
  };

  async function submit() {
    if (!file || loading) return;
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source_language', source);
      formData.append('target_language', target);
      const { data } = await api.post(endpoints.upload, formData);
      await api.post(endpoints.translate(data.id));
      const title = file.name.replace(/\.[^.]+$/, '');
      navigate(`/processing/${projectName(title)}`);
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return <div className="form-page">
    <div className="page-intro"><p className="kicker"><Sparkles size={15}/> NOUVEAU PROJET</p><h2>Donnez une nouvelle voix à votre film.</h2><p>Importez votre vidéo, choisissez vos langues et laissez VOSTFR AI faire le reste.</p></div>
    <div className="new-grid">
      <section className="panel upload-panel">
        <div className="section-title"><span className="step">01</span><div><h3>Votre vidéo</h3><p>MP4, MKV, AVI, MOV ou WEBM · 10 Go maximum</p></div></div>
        {!file ? <label className={`dropzone ${drag ? 'drag' : ''}`} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(event) => { event.preventDefault(); setDrag(false); choose(event.dataTransfer.files[0]); }}>
          <input type="file" accept="video/*,.mkv" onChange={(event) => choose(event.target.files?.[0])} />
          <span className="dropzone-orb"><UploadCloud size={26}/></span><strong>Glissez-déposez votre vidéo ici</strong><span>ou <b>parcourez vos fichiers</b></span><small>Vos fichiers restent privés et sécurisés.</small>
        </label> : <div className="file-card"><span className="file-icon"><FileVideo size={24}/></span><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} Mo · Prêt à être traité</small></div><button onClick={() => setFile(null)} aria-label="Retirer le fichier"><X size={17}/></button></div>}
        <div className="info-note"><Info size={16}/><span>Pour une meilleure qualité, utilisez une vidéo avec une piste audio claire.</span></div>
      </section>
      <section className="panel config-panel">
        <div className="section-title"><span className="step">02</span><div><h3>Configuration</h3><p>Personnalisez votre traduction</p></div></div>
        <div className="segmented" role="tablist" aria-label="Mode de détection de la langue">
          <button type="button" className={!manual ? 'active' : ''} onClick={() => { setManual(false); setSource('auto'); }}>Détection auto</button>
          <button type="button" className={manual ? 'active' : ''} onClick={() => { setManual(true); if (source === 'auto') setSource('en'); }}>Manuel</button>
        </div>
        <div className="settings-list">
          <div className="setting-row"><label htmlFor="source-language">Langue source</label><select id="source-language" value={source} onChange={(event) => setSource(event.target.value)}>{languages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>
          <div className="setting-row"><label htmlFor="target-language">Langue cible</label><select id="target-language" value={target} onChange={(event) => setTarget(event.target.value)}>{languages.filter(([code]) => code !== 'auto').map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>
          <div className="setting-row"><span className="setting-name">Format de sortie</span><span className="setting-value">SRT + VTT</span></div>
          <div className="setting-row"><label htmlFor="quality">Qualité de transcription</label><select id="quality" defaultValue="premium"><option value="premium">Premium — meilleure précision</option><option value="standard">Standard — rapide</option></select></div>
          <div className="setting-row"><span className="setting-name">Synchronisation auto</span><button type="button" role="switch" aria-checked={syncAuto} className={syncAuto ? 'ios-switch on' : 'ios-switch'} onClick={() => setSyncAuto((value) => !value)}><i/></button></div>
        </div>
        <div className="settings-list" style={{ marginTop: 14 }}>
          <div className="toggle-row"><span><strong>Traduction naturelle par IA</strong><small>Préserve le ton et le contexte</small></span><span className="toggle on"><i/></span></div>
          <div className="toggle-row"><span><strong>Conserver les expressions originales</strong><small>Idéal pour les dialogues culturels</small></span><span className="toggle"><i/></span></div>
        </div>
        {error && <p style={{ color: '#ff8298', fontSize: 12, margin: '14px 0 0' }}>{error}</p>}
        <button className="button primary full" style={{ marginTop: 18 }} disabled={!file || loading} onClick={submit}>{loading ? <><LoaderCircle size={17} className="spin"/><span>Envoi et lancement...</span></> : <><span>Lancer la traduction</span><ArrowRight size={17}/></>}</button>
        {!file && <small className="disabled-hint">Ajoutez une vidéo pour continuer</small>}
      </section>
    </div>
    <Link to="/dashboard" className="back-link">← Retour au tableau de bord</Link>
  </div>;
}
