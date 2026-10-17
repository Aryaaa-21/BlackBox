import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  Wifi,
  WifiOff,
  Radio,
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  Play,
  Activity,
  Zap,
  Terminal,
  Server,
  Lock,
} from 'lucide-react';
import MotionBlurText from '../ui/motion-blur-text';

type OperationalMode = 'online' | 'degraded' | 'offline';

interface QueueItem {
  id: string;
  action: string;
  target: string;
  badge: 'sync' | 'queue' | 'store';
  time: string;
}

export function HeroSection() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<OperationalMode>('online');
  const [queueCount, setQueueCount] = useState(0);
  const [stream, setStream] = useState<QueueItem[]>([
    { id: 'MUT_801', action: 'Perimeter Sweep Complete', target: 'Zone Alpha', badge: 'sync', time: 'Just now' },
    { id: 'EVT_442', action: 'Telemetry Heartbeat Sent', target: 'Relay #03', badge: 'sync', time: '1s ago' },
    { id: 'OBS_119', action: 'Hazard Marker Tagged', target: 'Substation B', badge: 'store', time: '4s ago' },
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle switching modes
  const handleModeChange = (newMode: OperationalMode) => {
    setMode(newMode);
    if (newMode === 'online') {
      setQueueCount(0);
      setStream((prev) => [
        { id: `SYNC_${Date.now().toString().slice(-4)}`, action: 'Queue Flushed to Cloud', target: 'Cluster Central', badge: 'sync', time: 'Just now' },
        ...prev.slice(0, 3),
      ]);
    } else if (newMode === 'degraded') {
      setQueueCount((c) => Math.max(c, 2));
      setStream((prev) => [
        { id: `WARN_${Date.now().toString().slice(-4)}`, action: 'High Latency Detected (420ms)', target: 'Mesh Node', badge: 'queue', time: 'Just now' },
        ...prev.slice(0, 3),
      ]);
    } else {
      setQueueCount((c) => Math.max(c, 5));
      setStream((prev) => [
        { id: `AIRGAP_${Date.now().toString().slice(-4)}`, action: 'Severed Link — Offline Mode Engaged', target: 'Local Dexie DB', badge: 'store', time: 'Just now' },
        ...prev.slice(0, 3),
      ]);
    }
  };

  // Simulate pushing a new mutation into the queue
  const handleSimulateMutation = () => {
    const randomActions = [
      { action: 'Updated Task: Sensor Calibration', target: 'Subsystem 4' },
      { action: 'Recorded Field Observation', target: 'Sector 7' },
      { action: 'Team Check-in: Op. Arjun', target: 'Perimeter Gate' },
      { action: 'Incident Severity Raised to HIGH', target: 'Command Grid' },
    ];
    const pick = randomActions[Math.floor(Math.random() * randomActions.length)];
    const newId = `MUT_${Math.floor(100 + Math.random() * 900)}`;

    if (mode === 'online') {
      setStream((prev) => [
        { id: newId, action: pick.action, target: pick.target, badge: 'sync', time: 'Synced 12ms' },
        ...prev.slice(0, 3),
      ]);
    } else {
      setQueueCount((c) => c + 1);
      setStream((prev) => [
        { id: newId, action: pick.action, target: pick.target, badge: mode === 'degraded' ? 'queue' : 'store', time: 'Cached locally' },
        ...prev.slice(0, 3),
      ]);
    }
  };

  // Canvas waveform generator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.lineWidth = 2;
      ctx.beginPath();

      if (mode === 'online') {
        ctx.strokeStyle = '#62d9df';
        ctx.shadowColor = '#62d9df';
        ctx.shadowBlur = 10;
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * 0.04 + step) * 16 + Math.cos(x * 0.015 + step * 0.7) * 8;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else if (mode === 'degraded') {
        ctx.strokeStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        for (let x = 0; x < width; x++) {
          const jitter = Math.sin(x * 12 + step * 5) > 0.6 ? (Math.random() - 0.5) * 14 : 0;
          const y = centerY + Math.sin(x * 0.03 + step * 1.5) * 20 + jitter;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      } else {
        // Offline / Air-gapped baseline heartbeat
        ctx.strokeStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 6;
        const pulseCenter = (step * 80) % (width + 60) - 30;
        for (let x = 0; x < width; x++) {
          let y = centerY;
          const dist = Math.abs(x - pulseCenter);
          if (dist < 25) {
            y = centerY + Math.sin((x - pulseCenter) * 0.15) * 26;
          }
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      step += mode === 'online' ? 0.05 : mode === 'degraded' ? 0.08 : 0.04;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [mode]);

  return (
    <section className="hero-v2" id="product" aria-label="BlackBox Operations Platform">
      {/* Ambient Cybernetic Lighting */}
      <div className="hero-v2__ambient" aria-hidden="true">
        <div className="hero-v2__glow-cyan" />
        <div className="hero-v2__glow-blue" />
        <div className="hero-v2__grid-lines" />
      </div>

      <div className="hero-v2__container">
        {/* Left Column: Mission Narrative & Actions */}
        <div className="hero-v2__copy">
          {/* Eyebrow Pill */}
          <div className="hero-v2__badge">
            <div className="hero-v2__badge-radar">
              <span className="hero-v2__badge-dot" />
              <span className="hero-v2__badge-ping" />
            </div>
            <span className="hero-v2__badge-text">Operational Continuity Engine</span>
            <span className="hero-v2__badge-divider" />
            <span className="hero-v2__badge-sub">ISO/IEC 25010 Resilient</span>
          </div>

          {/* Main Title with MotionBlurText */}
          <h1 className="hero-v2__title">
            <MotionBlurText color="#62d9df" blurAmount={35} angle={135} opacity={0.06} className="hero-v2__title-text">
              Operations continue when connectivity <span className="hero-v2__title-accent">dies.</span>
            </MotionBlurText>
          </h1>

          {/* Lede Narrative */}
          <p className="hero-v2__lede">
            Built for severed links, intermittent field networks, and air-gapped zones.
            <strong> BlackBox</strong> writes mutations locally first, queues operations safely in IndexedDB, resolves data collisions, and reconstructs reality from immutable event streams.
          </p>

          {/* CTAs */}
          <div className="hero-v2__actions">
            <button
              type="button"
              className="hero-v2__btn-primary"
              onClick={() => navigate('/dashboard')}
              id="hero-launch-console-btn"
            >
              <span>Launch Operations Console</span>
              <ArrowRight size={17} />
            </button>

            <Link to="/demo/motion-blur" className="hero-v2__btn-secondary" id="hero-explore-btn">
              <Play size={15} />
              <span>Explore Design System</span>
            </Link>
          </div>

          {/* Proof Pillars */}
          <div className="hero-v2__pillars">
            <div className="hero-v2__pillar">
              <div className="hero-v2__pillar-icon">
                <Database size={15} />
              </div>
              <div className="hero-v2__pillar-text">
                <strong>Zero Mutation Loss</strong>
                <span>Durable ACID local queue in IndexedDB</span>
              </div>
            </div>

            <div className="hero-v2__pillar">
              <div className="hero-v2__pillar-icon">
                <Zap size={15} />
              </div>
              <div className="hero-v2__pillar-text">
                <strong>Sub-10ms UI Latency</strong>
                <span>Instant optimistic local state transitions</span>
              </div>
            </div>

            <div className="hero-v2__pillar">
              <div className="hero-v2__pillar-icon">
                <Shield size={15} />
              </div>
              <div className="hero-v2__pillar-text">
                <strong>Deterministic Replay</strong>
                <span>Immutable, audit-grade MissionEvents</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Tactical Telemetry HUD */}
        <div className="hero-v2__hud" aria-label="Interactive Tactical Telemetry HUD">
          {/* HUD Header */}
          <div className="hero-v2__hud-header">
            <div className="hero-v2__hud-title">
              <Activity size={16} color="#62d9df" />
              <span className="hero-v2__hud-title-text">TELEMETRY_LINK // SIMULATOR</span>
            </div>
            <div className={`hero-v2__hud-status-chip hero-v2__hud-status-chip--${mode}`}>
              {mode === 'online' && <CheckCircle2 size={12} />}
              {mode === 'degraded' && <AlertTriangle size={12} />}
              {mode === 'offline' && <WifiOff size={12} />}
              <span>{mode.toUpperCase()}</span>
            </div>
          </div>

          {/* Interactive Mode Selector */}
          <div className="hero-v2__hud-modes" role="tablist" aria-label="Network Simulation Modes">
            <button
              type="button"
              className={`hero-v2__hud-mode-btn ${mode === 'online' ? 'hero-v2__hud-mode-btn--active' : ''}`}
              onClick={() => handleModeChange('online')}
            >
              <Wifi size={13} />
              <span>1. Online</span>
            </button>
            <button
              type="button"
              className={`hero-v2__hud-mode-btn ${mode === 'degraded' ? 'hero-v2__hud-mode-btn--active' : ''}`}
              onClick={() => handleModeChange('degraded')}
            >
              <Radio size={13} />
              <span>2. Degraded</span>
            </button>
            <button
              type="button"
              className={`hero-v2__hud-mode-btn ${mode === 'offline' ? 'hero-v2__hud-mode-btn--active' : ''}`}
              onClick={() => handleModeChange('offline')}
            >
              <WifiOff size={13} />
              <span>3. Air-Gapped</span>
            </button>
          </div>

          {/* Oscilloscope Waveform Canvas */}
          <div className="hero-v2__waveform-container">
            <canvas ref={canvasRef} width={460} height={90} className="hero-v2__waveform-canvas" />
            <div className="hero-v2__waveform-overlay">
              <span className="hero-v2__waveform-label">Transport Spectrum</span>
              <span className="hero-v2__waveform-metric">
                {mode === 'online' ? '12.4 kb/s // LOW JITTER' : mode === 'degraded' ? '3.1 kb/s // 38% LOSS' : '0.0 kb/s // AIR-GAP'}
              </span>
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="hero-v2__telemetry-grid">
            <div className="hero-v2__telemetry-card">
              <small>Latency</small>
              <strong>{mode === 'online' ? '14 ms' : mode === 'degraded' ? '460 ms' : 'N/A (Offline)'}</strong>
            </div>
            <div className="hero-v2__telemetry-card">
              <small>Local Queue</small>
              <strong style={{ color: queueCount > 0 ? '#f59e0b' : '#62d9df' }}>
                {queueCount} {queueCount === 1 ? 'mutation' : 'mutations'}
              </strong>
            </div>
            <div className="hero-v2__telemetry-card">
              <small>Persistence</small>
              <strong>IndexedDB v4</strong>
            </div>
          </div>

          {/* Live Mutation Stream with Interactive Simulation */}
          <div className="hero-v2__stream">
            <div className="hero-v2__stream-head">
              <span className="hero-v2__stream-title">
                <Terminal size={12} />
                <span>Live Mutation Bus</span>
              </span>
              <button
                type="button"
                className="hero-v2__stream-action"
                onClick={handleSimulateMutation}
                title="Queue a test mutation to see how BlackBox handles offline writes"
              >
                + Push Mutation
              </button>
            </div>

            <div className="hero-v2__stream-list">
              {stream.map((item) => (
                <div key={item.id} className="hero-v2__stream-item">
                  <div className="hero-v2__stream-item-left">
                    <span
                      className={`hero-v2__stream-item-badge hero-v2__stream-item-badge--${item.badge}`}
                    >
                      {item.badge.toUpperCase()}
                    </span>
                    <span>{item.action}</span>
                  </div>
                  <span className="hero-v2__stream-item-time">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
