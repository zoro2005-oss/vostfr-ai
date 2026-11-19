import { useEffect, useState } from 'react';
import { Languages as LanguagesIcon, Plus, Save, Trash2 } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { EngineRow, LanguageRow } from '../types';
import { DataTable, Modal, Panel, useToast, type Column } from '../ui';

type EngineConfig = { translation: EngineRow[]; voice: EngineRow[] };

export default function Languages() {
  const toast = useToast();
  const [languages, setLanguages] = useState<LanguageRow[]>([]);
  const [engines, setEngines] = useState<EngineConfig>({ translation: [], voice: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LanguageRow | null>(null);
  const [form, setForm] = useState({ code: '', name: '', source: true, target: true });
  const [voiceText, setVoiceText] = useState('');

  useEffect(() => {
    Promise.all([
      adminApi.get<LanguageRow[]>('/languages'),
      adminApi.get<EngineConfig>('/engines'),
    ]).then(([langs, engineData]) => { setLanguages(langs); setEngines(engineData); })
      .catch((error) => toast.error(getApiError(error)))
      .finally(() => setLoading(false));
  }, [toast]);

  const persistLanguages = async (next: LanguageRow[]) => {
    setLanguages(next);
    try { await adminApi.put('/languages', next); toast.success('Langues enregistrées'); }
    catch (error) { toast.error(getApiError(error)); }
  };

  const persistEngine = async (kind: 'translation' | 'voice', next: EngineRow[]) => {
    setEngines((current) => ({ ...current, [kind]: next }));
    try { await adminApi.put(`/engines/${kind}`, next); toast.success('Moteurs mis à jour'); }
    catch (error) { toast.error(getApiError(error)); }
  };

  const columns: Column<LanguageRow>[] = [
    { key: 'name', label: 'Langue', render: (row) => <span className="cell-main">{row.name}</span> },
    { key: 'code', label: 'Code', render: (row) => row.code },
    { key: 'source', label: 'Langue source', render: (row) => <button type="button" className={`ios-switch ${row.source ? 'on' : ''}`} aria-label="Langue source" onClick={() => persistLanguages(languages.map((item) => item.code === row.code ? { ...item, source: !item.source } : item))}><i/></button> },
    { key: 'target', label: 'Langue cible', render: (row) => <button type="button" className={`ios-switch ${row.target ? 'on' : ''}`} aria-label="Langue cible" onClick={() => persistLanguages(languages.map((item) => item.code === row.code ? { ...item, target: !item.target } : item))}><i/></button> },
    { key: 'voices', label: 'Voix', render: (row) => `${(row.voices || []).length} voix` },
    { key: 'actions', label: '', render: (row) => <div className="admin-actions-cell">
      <button type="button" className="admin-icon-btn" title="Modifier" onClick={() => { setEditing(row); setForm({ code: row.code, name: row.name, source: row.source, target: row.target }); setVoiceText((row.voices || []).map((voice) => voice.name).join(', ')); }}><Save size={15}/></button>
      <button type="button" className="admin-icon-btn danger" title="Supprimer" onClick={() => persistLanguages(languages.filter((item) => item.code !== row.code))}><Trash2 size={15}/></button>
    </div> },
  ];

  return <>
    <div className="admin-toolbar">
      <button type="button" className="button primary" onClick={() => { setEditing({ code: '', name: '', source: true, target: true, voices: [] }); setForm({ code: '', name: '', source: true, target: true }); setVoiceText(''); }}><Plus size={16}/> Ajouter une langue</button>
    </div>

    <Panel title="Langues disponibles" subtitle="Sources, cibles et voix utilisées par les générations">
      <DataTable columns={columns} rows={languages} loading={loading} empty="Aucune langue configurée."/>
    </Panel>

    <div className="admin-grid">
      <Panel title="Moteurs de traduction" subtitle="Activer ou désactiver un fournisseur">
        <div className="admin-list">
          {engines.translation.map((engine, index) => <div key={engine.id} className="admin-list-row">
            <LanguagesIcon size={16} color="var(--accent)"/>
            <div className="grow"><strong>{engine.name}</strong><small>{engine.id}</small></div>
            <button type="button" className={`ios-switch ${engine.enabled ? 'on' : ''}`} aria-label={`Activer ${engine.name}`} onClick={() => persistEngine('translation', engines.translation.map((item, i) => i === index ? { ...item, enabled: !item.enabled } : item))}><i/></button>
          </div>)}
        </div>
      </Panel>
      <Panel title="Synthèse vocale et qualité audio" subtitle="Moteurs TTS et qualité de rendu">
        <div className="admin-list">
          {engines.voice.map((engine, index) => <div key={engine.id} className="admin-list-row">
            <div className="grow"><strong>{engine.name}</strong><small>{engine.id}</small></div>
            <select value={engine.quality || 'high'} onChange={(event) => persistEngine('voice', engines.voice.map((item, i) => i === index ? { ...item, quality: event.target.value } : item))} aria-label="Qualité audio">
              <option value="standard">Standard</option><option value="high">Haute</option><option value="studio">Studio</option>
            </select>
            <button type="button" className={`ios-switch ${engine.enabled ? 'on' : ''}`} aria-label={`Activer ${engine.name}`} onClick={() => persistEngine('voice', engines.voice.map((item, i) => i === index ? { ...item, enabled: !item.enabled } : item))}><i/></button>
          </div>)}
        </div>
      </Panel>
    </div>

    <Modal open={Boolean(editing)} title={editing?.name ? 'Modifier la langue' : 'Ajouter une langue'} onClose={() => setEditing(null)} footer={<>
      <button type="button" className="button secondary" onClick={() => setEditing(null)}>Annuler</button>
      <button type="button" className="button primary" onClick={() => {
        if (!form.code.trim() || !form.name.trim()) { toast.error('Code et nom sont requis'); return; }
        const voiceNames = voiceText.split(',').map((value) => value.trim()).filter(Boolean);
        const entry: LanguageRow = { code: form.code.trim().toLowerCase(), name: form.name.trim(), source: form.source, target: form.target, voices: voiceNames.map((name) => ({ id: name.toLowerCase().replace(/\s+/g, '_'), name })) };
        const next = languages.some((item) => item.code === entry.code)
          ? languages.map((item) => item.code === entry.code ? entry : item)
          : [...languages, entry];
        persistLanguages(next).then(() => setEditing(null));
      }}>Enregistrer</button>
    </>}>
      <div className="admin-form">
        <label className="admin-field"><span>Nom</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Japonais"/></label>
        <label className="admin-field"><span>Code</span><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="ja"/></label>
        <label className="admin-field"><span>Utilisable comme source</span><select value={form.source ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, source: event.target.value === 'yes' })}><option value="yes">Oui</option><option value="no">Non</option></select></label>
        <label className="admin-field"><span>Utilisable comme cible</span><select value={form.target ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, target: event.target.value === 'yes' })}><option value="yes">Oui</option><option value="no">Non</option></select></label>
        <label className="admin-field wide"><span>Voix disponibles (séparées par des virgules)</span><input value={voiceText} onChange={(event) => setVoiceText(event.target.value)} placeholder="Voix masculine, Voix féminine"/></label>
      </div>
    </Modal>
  </>;
}
