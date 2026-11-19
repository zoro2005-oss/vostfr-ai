import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, HardDrive, RefreshCw, Video } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { MonitoringData } from '../types';
import { Panel, formatDate, useToast } from '../ui';

export default function Monitoring() {
  const toast = useToast();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<MonitoringData>('/monitoring')
      .then(setData)
      .catch((error) => toast.error(getApiError(error)))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const exportErrors = () => {
    const lines = [['Date', 'Service concerné', 'Message'], ...(data?.api_errors || []).map((error) => [
      error.created_at || '', error.resource || '', `"${(error.message || '').replace(/"/g, '""')}"`,
    ])];
    const url = URL.createObjectURL(new Blob([lines.map((line) => line.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'problemes-rencontres.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) return <div className="admin-loading"><RefreshCw size={20} className="spin"/> Vérification du service…</div>;

  const usedGb = (data?.storage.bytes || 0) / (1024 ** 3);
  const limitGb = data?.storage.limit_gb || 10;
  const percent = Math.min(100, (usedGb / limitGb) * 100);
  const failed = data?.failed_generations || 0;
  const errors = data?.api_errors || [];
  const allGood = failed === 0 && errors.length === 0;

  return <>
    <div className="admin-toolbar">
      <button type="button" className="button secondary" onClick={load}><RefreshCw size={16}/> Actualiser</button>
    </div>

    <div className={`admin-simple-intro ${allGood ? '' : 'warning'}`}>
      {allGood ? <CheckCircle2 size={20}/> : <AlertTriangle size={20}/>}
      <div>
        <strong>{allGood ? 'Tout fonctionne normalement' : 'Quelques points à vérifier'}</strong>
        <p>
          {allGood
            ? 'Aucune vidéo en échec et aucun problème récent détecté. Vous pouvez continuer à utiliser la plateforme sereinement.'
            : `${failed} vidéo(s) n’ont pas pu être générée(s) et ${errors.length} problème(s) récent(s) ont été relevé(s). Le détail est affiché ci-dessous.`}
        </p>
      </div>
    </div>

    <div className="admin-kpi">
      <Panel title="Espace utilisé" subtitle={`${data?.storage.files || 0} fichiers conservés`}>
        <div className="admin-storage"><HardDrive size={22} color="var(--accent)"/><div className="grow"><strong>{usedGb.toFixed(2)} Go / {limitGb} Go</strong><div className="admin-progress"><i style={{ width: `${percent}%` }}/></div></div></div>
      </Panel>
      <Panel title="Vidéos en échec" subtitle="Traitements qui n’ont pas abouti">
        <div className="admin-hero-stat"><Video size={22} color={failed ? '#ff8b82' : '#5ee07f'}/><strong>{failed}</strong></div>
      </Panel>
      <Panel title="Problèmes récents" subtitle="Erreurs détectées dernièrement">
        <div className="admin-hero-stat"><AlertTriangle size={22} color={errors.length ? '#ff8b82' : '#5ee07f'}/><strong>{errors.length}</strong></div>
      </Panel>
    </div>

    <Panel title="Détail des problèmes" subtitle="Ce qui a été détecté, expliqué simplement" actions={<button type="button" className="button secondary" onClick={exportErrors}><Download size={16}/> Télécharger</button>}>
      <div className="admin-list">
        {errors.length === 0 && <div className="admin-empty"><CheckCircle2 size={22}/> Aucun problème récent. Tout est normal.</div>}
        {errors.map((error) => <div key={error.id} className="admin-list-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <AlertTriangle size={14} color="#ff8b82"/>
            <strong style={{ fontSize: 12 }}>{error.resource || 'Service inconnu'}</strong>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-2)' }}>{formatDate(error.created_at)}</span>
          </div>
          <div className="admin-log" style={{ width: '100%', maxHeight: 90 }}>{error.message}</div>
        </div>)}
      </div>
    </Panel>
  </>;
}
