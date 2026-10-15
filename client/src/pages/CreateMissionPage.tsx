import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, Flag, Loader2, MapPin, Plus, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMissionStore } from '../store/missionStore';
import { MissionSeverity } from '../types';

export const CreateMissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { createMission, isCreating, error, clearError } = useMissionStore();
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [location, setLocation] = useState(''); const [severity, setSeverity] = useState<MissionSeverity>('MEDIUM');
  const [validation, setValidation] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); clearError();
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Mission title is required.';
    if (!location.trim()) next.location = 'Location is required.';
    if (!description.trim()) next.description = 'Description is required.';
    setValidation(next); if (Object.keys(next).length) return;
    try { const mission = await createMission({ title: title.trim(), description: description.trim(), location: location.trim(), severity }); navigate(`/missions/${mission.id}`); } catch { /* store owns the request error */ }
  };
  const fieldClass = (name: string) => `ops-control w-full ${validation[name] ? 'border-blackbox-borderLight' : ''}`;
  return (
    <div className="ops-page mx-auto max-w-4xl space-y-6">
      <header className="ops-page-header"><div className="flex items-start gap-3"><Link to="/missions" className="ops-button-quiet min-h-10 min-w-10 px-2" aria-label="Back to missions"><ArrowLeft className="h-4 w-4" /></Link><div><div className="ops-kicker text-blackbox-cyan">New mission</div><h1 className="ops-page-title">Create an operational mission</h1><p className="ops-page-subtitle">Define the working context first. Tasks, team, and observations are managed from the mission workspace.</p></div></div></header>
      {error && <div role="alert" className="flex items-start gap-3 rounded-lg border border-blackbox-borderLight bg-blackbox-panel p-4 text-sm text-blackbox-textSecondary"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blackbox-warning" />{error}</div>}
      <form onSubmit={submit} className="ops-surface space-y-7 p-5 sm:p-7">
        <div><label htmlFor="mission-title" className="mb-2 block text-sm font-semibold">Mission title</label><input id="mission-title" value={title} onChange={(event) => { setTitle(event.target.value); setValidation((current) => ({ ...current, title: '' })); }} maxLength={200} className={fieldClass('title')} placeholder="Campus emergency drill" />{validation.title && <p className="mt-2 text-xs text-blackbox-warning">{validation.title}</p>}</div>
        <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]"><div><label htmlFor="mission-location" className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-blackbox-cobalt" />Location</label><input id="mission-location" value={location} onChange={(event) => { setLocation(event.target.value); setValidation((current) => ({ ...current, location: '' })); }} maxLength={200} className={fieldClass('location')} placeholder="Building B, Sector 4" />{validation.location && <p className="mt-2 text-xs text-blackbox-warning">{validation.location}</p>}</div><fieldset><legend className="mb-2 flex items-center gap-2 text-sm font-semibold"><Flag className="h-4 w-4 text-blackbox-cobalt" />Severity</legend><div className="grid grid-cols-2 gap-2">{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as MissionSeverity[]).map((option) => <button key={option} type="button" aria-pressed={severity === option} onClick={() => setSeverity(option)} className={`min-h-11 rounded-lg border px-3 text-left font-mono text-xs transition-colors ${severity === option ? 'border-blackbox-cyan bg-blackbox-cyan/10 text-blackbox-text' : 'border-blackbox-border bg-blackbox-panel text-blackbox-muted hover:border-blackbox-borderLight'}`}>{option}</button>)}</div></fieldset></div>
        <div><label htmlFor="mission-description" className="mb-2 block text-sm font-semibold">Mission description</label><textarea id="mission-description" rows={7} value={description} onChange={(event) => { setDescription(event.target.value); setValidation((current) => ({ ...current, description: '' })); }} maxLength={5000} className={`${fieldClass('description')} resize-y py-3`} placeholder="Objectives, operating parameters, hazards, and context…" />{validation.description ? <p className="mt-2 text-xs text-blackbox-warning">{validation.description}</p> : <div className="mt-2 text-right font-mono text-[10px] text-blackbox-muted">{description.length}/5000</div>}</div>
        <div className="flex items-start gap-3 border-y border-blackbox-border py-4 text-xs leading-5 text-blackbox-muted"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blackbox-cobalt" /><span>New missions start in <strong className="text-blackbox-text">DRAFT</strong> status. Start the lifecycle from the mission workspace after the context is ready.</span></div>
        <div className="flex flex-col-reverse gap-2 border-t border-blackbox-border pt-5 sm:flex-row sm:justify-end"><Link to="/missions" className="ops-button-quiet">Cancel</Link><button type="submit" disabled={isCreating} className="ops-button-primary">{isCreating ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : <><Plus className="h-4 w-4" />Create mission</>}</button></div>
      </form>
    </div>
  );
};
