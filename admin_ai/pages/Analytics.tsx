import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Film, LoaderCircle, Sparkles, Users } from 'lucide-react';
import { adminApi, getApiError } from '../api';
import type { AnalyticsData } from '../types';
import { Panel, Stat, formatMoney, useToast } from '../ui';

export default function Analytics() {
  const toast = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    adminApi.get<AnalyticsData>('/analytics', { days }).then(setData).catch((error) => toast.error(getApiError(error)));
  }, [days, toast]);

  const exportReport = () => {
    if (!data) return;
    const rows = [
      ['Date', 'Vidéos générées'],
      ...data.series.map((point) => [point.date, point.value]),
      [], ['Formule', 'Revenus', 'Abonnés'],
      ...data.margins.map((row) => [row.plan, row.revenue, row.subscribers]),
    ];
    const csv = rows.map((row) => row.join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'chiffres-vostfr-ai.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Rapport téléchargé');
  };

  if (!data) return <div className="admin-loading"><LoaderCircle size={20} className="spin"/> Préparation des chiffres…</div>;

  return <>
    <div className="admin-toolbar">
      <div className="admin-filters">
        <button type="button" className={`filter-pill ${days === 7 ? 'active' : ''}`} onClick={() => setDays(7)}>7 jours</button>
        <button type="button" className={`filter-pill ${days === 30 ? 'active' : ''}`} onClick={() => setDays(30)}>30 jours</button>
        <button type="button" className={`filter-pill ${days === 365 ? 'active' : ''}`} onClick={() => setDays(365)}>12 mois</button>
      </div>
      <button type="button" className="button secondary" onClick={exportReport}><Download size={16}/> Télécharger le rapport</button>
    </div>

    <div className="admin-simple-intro">
      <CheckCircle2 size={20}/>
      <div>
        <strong>En clair</strong>
        <p>
          En moyenne, {data.generations_per_day} vidéos sont générées chaque jour et {data.dau} personnes utilisent l’outil quotidiennement. Voici les chiffres simples de la période choisie.
        </p>
      </div>
    </div>

    <div className="admin-kpi">
      <Stat icon={Users} label="Utilisateurs par jour" value={data.dau} hint="Personnes actives chaque jour" tone="blue"/>
      <Stat icon={Users} label="Utilisateurs par mois" value={data.mau} hint="Personnes actives sur le mois"/>
      <Stat icon={Film} label="Vidéos par jour" value={data.generations_per_day} hint="Moyenne de traitements" tone="violet"/>
      <Stat icon={Sparkles} label="Revenus mensuels" value={formatMoney(data.mrr)} hint="Estimation récurrente" tone="green"/>
    </div>

    <div className="admin-grid">
      <Panel title="Vidéos générées par jour" subtitle="Combien de vidéos ont été traitées chaque jour">
        <div className="admin-list">
          {data.series.length === 0 && <div className="admin-empty">Aucune vidéo générée sur cette période.</div>}
          {data.series.map((point) => <div key={point.date} className="admin-list-row">
            <Film size={16} color="var(--accent)"/>
            <div className="grow"><strong>{point.date}</strong></div>
            <strong>{point.value} vidéo(s)</strong>
          </div>)}
        </div>
      </Panel>

      <Panel title="Revenus par formule" subtitle="Ce que rapporte chaque abonnement">
        <div className="admin-list">
          {data.margins.length === 0 && <div className="admin-empty">Aucun revenu enregistré.</div>}
          {data.margins.map((row) => <div key={row.plan} className="admin-list-row">
            <Sparkles size={16} color="#5ee07f"/>
            <div className="grow"><strong>{row.plan}</strong><small>{row.subscribers} abonné(s)</small></div>
            <strong>{formatMoney(row.revenue)}</strong>
          </div>)}
        </div>
      </Panel>
    </div>
  </>;
}
