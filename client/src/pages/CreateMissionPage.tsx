import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, AlertTriangle, Plus, MapPin, AlignLeft, Flag } from 'lucide-react';
import { useMissionStore } from '../store/missionStore';
import { MissionSeverity } from '../types';
import { MissionSeverityBadge } from '../components/Missions/MissionSeverityBadge';

export const CreateMissionPage: React.FC = () => {
  const navigate = useNavigate();
  const { createMission, isCreating, error, clearError } = useMissionStore();

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    location: string;
    severity: MissionSeverity;
  }>({
    title: '',
    description: '',
    location: '',
    severity: 'MEDIUM',
  });

  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    description?: string;
    location?: string;
  }>({});

  const validate = (): boolean => {
    const errors: { title?: string; description?: string; location?: string } = {};

    if (!formData.title.trim()) {
      errors.title = 'Mission title is required';
    } else if (formData.title.trim().length > 200) {
      errors.title = 'Title cannot exceed 200 characters';
    }

    if (!formData.location.trim()) {
      errors.location = 'Operational location is required';
    } else if (formData.location.trim().length > 200) {
      errors.location = 'Location cannot exceed 200 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Mission description is required';
    } else if (formData.description.trim().length > 5000) {
      errors.description = 'Description cannot exceed 5000 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validate()) {
      return;
    }

    try {
      const created = await createMission({
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        severity: formData.severity,
      });

      navigate(`/missions/${created.id}`);
    } catch {
      // Error is set in store
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-blackbox-border">
        <Link
          to="/missions"
          className="p-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-blackbox-muted hover:text-blackbox-text transition-colors"
          title="Back to Missions"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blackbox-cyan animate-pulse" />
            <span className="text-xs font-mono text-blackbox-cyan uppercase tracking-wider font-semibold">
              COMMAND DIRECTIVE // MISSION CREATION
            </span>
          </div>
          <h2 className="text-xl font-bold font-mono text-blackbox-text mt-0.5">
            Create Operational Mission
          </h2>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/60 text-xs font-mono text-rose-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blackbox-critical shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold text-rose-200 uppercase tracking-wide">
              Creation Failed
            </div>
            <div className="mt-0.5 text-rose-300/90">{error}</div>
          </div>
        </div>
      )}

      {/* Form Container */}
      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-xl bg-blackbox-surface border border-blackbox-border space-y-6 shadow-sm"
      >
        {/* Title */}
        <div>
          <label
            htmlFor="mission-title"
            className="block text-xs font-mono font-semibold text-blackbox-text uppercase tracking-wider mb-1.5"
          >
            Mission Title <span className="text-blackbox-critical">*</span>
          </label>
          <div className="relative">
            <input
              id="mission-title"
              type="text"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (validationErrors.title) {
                  setValidationErrors({ ...validationErrors, title: undefined });
                }
              }}
              placeholder="e.g. Campus Building B Emergency Drill"
              maxLength={200}
              className={`w-full px-3.5 py-2.5 rounded-lg bg-blackbox-bg border text-sm font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:ring-1 transition-all ${
                validationErrors.title
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-blackbox-border focus:border-blackbox-cyan focus:ring-blackbox-cyan'
              }`}
            />
          </div>
          {validationErrors.title && (
            <p className="mt-1.5 text-xs font-mono text-blackbox-critical">
              {validationErrors.title}
            </p>
          )}
        </div>

        {/* Severity & Location Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Severity */}
          <div>
            <label
              htmlFor="mission-severity"
              className="block text-xs font-mono font-semibold text-blackbox-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <Flag className="w-3.5 h-3.5 text-blackbox-cyan" />
              <span>Severity Level</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as MissionSeverity[]).map((level) => {
                const isSelected = formData.severity === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({ ...formData, severity: level })}
                    className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-blackbox-cyan bg-cyan-950/20'
                        : 'border-blackbox-border bg-blackbox-panel/40 hover:bg-blackbox-panel hover:border-blackbox-border/80'
                    }`}
                  >
                    <MissionSeverityBadge severity={level} size="sm" />
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blackbox-cyan" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location */}
          <div>
            <label
              htmlFor="mission-location"
              className="block text-xs font-mono font-semibold text-blackbox-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5 text-blackbox-cyan" />
              <span>Location / Area Sector <span className="text-blackbox-critical">*</span></span>
            </label>
            <input
              id="mission-location"
              type="text"
              value={formData.location}
              onChange={(e) => {
                setFormData({ ...formData, location: e.target.value });
                if (validationErrors.location) {
                  setValidationErrors({ ...validationErrors, location: undefined });
                }
              }}
              placeholder="e.g. Building B, Sector 4"
              maxLength={200}
              className={`w-full px-3.5 py-2.5 rounded-lg bg-blackbox-bg border text-sm font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:ring-1 transition-all ${
                validationErrors.location
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-blackbox-border focus:border-blackbox-cyan focus:ring-blackbox-cyan'
              }`}
            />
            {validationErrors.location && (
              <p className="mt-1.5 text-xs font-mono text-blackbox-critical">
                {validationErrors.location}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="mission-description"
            className="block text-xs font-mono font-semibold text-blackbox-text uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
          >
            <AlignLeft className="w-3.5 h-3.5 text-blackbox-cyan" />
            <span>Mission Description <span className="text-blackbox-critical">*</span></span>
          </label>
          <textarea
            id="mission-description"
            rows={5}
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              if (validationErrors.description) {
                setValidationErrors({ ...validationErrors, description: undefined });
              }
            }}
            placeholder="Detailed directives, operational parameters, objectives, and hazards..."
            maxLength={5000}
            className={`w-full px-3.5 py-2.5 rounded-lg bg-blackbox-bg border text-sm font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:ring-1 transition-all ${
              validationErrors.description
                ? 'border-rose-500 focus:ring-rose-500'
                : 'border-blackbox-border focus:border-blackbox-cyan focus:ring-blackbox-cyan'
            }`}
          />
          <div className="flex justify-between items-center mt-1">
            {validationErrors.description ? (
              <p className="text-xs font-mono text-blackbox-critical">
                {validationErrors.description}
              </p>
            ) : <span />}
            <span className="text-[11px] font-mono text-blackbox-muted">
              {formData.description.length}/5000
            </span>
          </div>
        </div>

        {/* Notice of State */}
        <div className="p-3.5 rounded-lg bg-blackbox-panel/60 border border-blackbox-border text-xs font-mono text-blackbox-muted flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blackbox-cyan shrink-0" />
          <span>Missions are initially registered in <strong className="text-blackbox-text">DRAFT</strong> status and can be initiated directly from the Mission Workspace.</span>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-blackbox-border">
          <Link
            to="/missions"
            className="px-4 py-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-text transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isCreating}
            className="px-5 py-2.5 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black font-mono font-semibold text-xs border border-cyan-400 transition-all flex items-center gap-2 shadow-[0_0_12px_rgba(0,210,255,0.2)] disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Registering Mission...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Establish Mission</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
