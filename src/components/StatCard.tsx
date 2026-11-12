import { ArrowUpRight, Clapperboard, Languages, FileText, Clock3 } from 'lucide-react';
const icons={film:Clapperboard, languages:Languages,file:FileText,clock:Clock3};
export default function StatCard({icon,label,value,delta}:{icon:keyof typeof icons;label:string;value:string;delta:string}){const I=icons[icon];return <div className="stat-card"><div className="stat-icon"><I size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-delta"><span>{delta}</span> <ArrowUpRight size={13}/><small>vs. mois dernier</small></div></div>}
