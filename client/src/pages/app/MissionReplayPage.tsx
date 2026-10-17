import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { replayApi } from '../../api'
import { Button, Card, EmptyState, ErrorState, LoadingState, SelectField, SectionHeading, StatusBadge } from '../../components/ui'
import FeaturesBlock from '../../components/ui/features-4'
import { useOperationsStore } from '../../stores/operations.store'
import { shortDate, shortTime } from '../../lib/format'
import type { ReplayData } from '../../types'
import { clampReplayIndex, reconstructReplay } from '../../services/replay'

export function MissionReplayPage() {
  const { missionId: routeMissionId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { missions, loadMissions } = useOperationsStore()
  const [missionId, setMissionId] = useState(routeMissionId || searchParams.get('mission') || '')
  const [data, setData] = useState<ReplayData | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => { if (!missions.length) void loadMissions({ limit: 50 }) }, [missions.length, loadMissions])
  useEffect(() => { if (routeMissionId && routeMissionId !== missionId) setMissionId(routeMissionId) }, [routeMissionId, missionId])
  useEffect(() => {
    if (missionId && searchParams.get('mission') !== missionId) {
      setSearchParams({ mission: missionId }, { replace: true })
    }
  }, [missionId, searchParams, setSearchParams])
  useEffect(() => {
    let cancelled = false
    setPlaying(false); setIndex(0); setData(null); setError(null)
    if (!missionId) return
    void replayApi.all(missionId, { limit: 5000 })
      .then((result) => { if (!cancelled) setData(result) })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load replay') })
    return () => { cancelled = true }
  }, [missionId, reload])
  useEffect(() => {
    if (!playing || !data?.events.length) return
    const timer = window.setInterval(() => setIndex((value) => {
      if (value >= data.events.length) { setPlaying(false); return value }
      return value + 1
    }), 1000 / speed)
    return () => window.clearInterval(timer)
  }, [playing, speed, data?.events.length])

  const events = data?.events || []
  const frameIndex = clampReplayIndex(index, events.length + 1)
  const rawCurrent = events[frameIndex - 1]
  const current = rawCurrent && typeof rawCurrent === 'object' ? {
    actor: { name: typeof rawCurrent.actor?.name === 'string' ? rawCurrent.actor.name : 'Unavailable' },
    targetType: typeof rawCurrent.targetType === 'string' ? rawCurrent.targetType : 'Unavailable',
    source: typeof rawCurrent.source === 'string' ? rawCurrent.source : 'Unavailable',
  } : null
  const history = useMemo(() => reconstructReplay(data?.events || []), [data])
  const state = useMemo(() => reconstructReplay((data?.events || []).slice(0, frameIndex)), [data, frameIndex])
  const selected = state.timeline.at(-1)

  return <>
    <SectionHeading eyebrow="Operations / Replay" title="Mission replay" description="Review recorded event history and inspect the operational state at a point in time." />
    <div className="toolbar"><SelectField label="Mission" value={missionId} onChange={(event) => setMissionId(event.target.value)}><option value="">Select a mission</option>{missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.title}</option>)}</SelectField></div>
    {error ? <ErrorState message={error} onRetry={() => setReload((value) => value + 1)} /> : null}
    {!missionId ? <Card><EmptyState title="Select a mission" description="Choose a mission to load its chronological event history." /></Card> : null}
    {missionId && !data && !error ? <LoadingState label="Loading replay" /> : null}
    {data ? <div className="split-grid">
      <Card><div className="card__header"><div><span className="eyebrow">Event timeline</span><h2>{data.mission.title}</h2></div><span className="mono">{frameIndex} / {events.length}</span></div>
        {data.history?.notice || data.history?.limited ? <p role="status" className="detail-panel__body">{data.history.notice || 'Partial history: seek is limited to loaded events.'}{data.history.pendingExcluded ? ` ${data.history.pendingExcluded} pending local event(s) excluded.` : ''}</p> : null}
        <div className="replay-controls" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}><Button variant="ghost" disabled={frameIndex === 0} onClick={() => { setIndex((value) => clampReplayIndex(value - 1, events.length + 1)); setPlaying(false) }} aria-label="Previous event"><ChevronLeft size={16} />Previous</Button><Button disabled={!events.length || (!playing && frameIndex === events.length)} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play'}</Button><Button variant="ghost" disabled={frameIndex === events.length} onClick={() => { setIndex((value) => clampReplayIndex(value + 1, events.length + 1)); setPlaying(false) }}>Next<ChevronRight size={16} /></Button><Button variant="quiet" onClick={() => { setIndex(0); setPlaying(false) }}><RotateCcw size={15} />Reset</Button><div className="replay-controls__speed">{[0.5, 1, 2, 4].map((value) => <button key={value} className={`tab ${speed === value ? 'tab--active' : ''}`} onClick={() => setSpeed(value)}>{value}x</button>)}</div><input aria-label="Seek loaded replay history" type="range" min={0} max={events.length} value={frameIndex} disabled={!events.length} onChange={(event) => { setIndex(clampReplayIndex(Number(event.target.value), events.length + 1)); setPlaying(false) }} /></div>
        <div className="replay-timeline">{history.timeline.map((event, eventIndex) => <button key={`${event.id}:${eventIndex}`} className={`replay-event ${eventIndex + 1 === frameIndex ? 'replay-event--active' : ''} ${eventIndex < frameIndex ? 'replay-event--seen' : ''}`} onClick={() => { setIndex(eventIndex + 1); setPlaying(false) }}><span>{event.createdAt ? shortTime(event.createdAt) : 'Unknown time'}</span><i aria-hidden="true" /><div><strong>{event.eventType}</strong><small>{event.warnings.length ? 'Warning: incomplete or unsupported event' : 'Recorded event'}</small></div></button>)}</div>
      </Card>
      <div className="stack"><Card><div className="card__header"><div><span className="eyebrow">State at this moment</span><h2>{selected?.createdAt ? shortDate(selected.createdAt) : 'Before first event'}</h2></div></div><div className="detail-panel__body replay-state"><div className="replay-state__line"><span>Mission status</span><StatusBadge status={state.mission?.status || 'UNKNOWN'} /></div><div className="replay-state__line"><span>Tasks observed</span><strong>{Object.keys(state.tasks).length}</strong></div><div className="replay-state__line"><span>Active team members</span><strong>{Object.values(state.members).filter((member) => member.status === 'ACTIVE').length}</strong></div><div className="replay-state__line"><span>Observations</span><strong>{state.observations.length}</strong></div><div className="replay-state__line"><span>Connectivity</span><strong>{state.network}</strong></div><div className="replay-state__line"><span>Sync</span><strong>{state.sync}</strong></div><div className="replay-state__line"><span>Recorded conflicts</span><strong>{Object.keys(state.conflicts).length}</strong></div>{state.warnings.length ? <p role="status">Historical fields may be unavailable. {state.warnings.length} event warning(s); select timeline entries for details.</p> : null}</div></Card><Card><div className="card__header"><div><span className="eyebrow">Selected event</span><h2>{selected?.eventType || '—'}</h2></div></div>{selected ? <div className="detail-panel__body"><dl className="metadata-list"><div><dt>Timestamp</dt><dd>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : 'Unavailable'}</dd></div><div><dt>Actor</dt><dd>{current?.actor?.name || 'Unavailable'}</dd></div><div><dt>Target</dt><dd>{current?.targetType || '—'}</dd></div><div><dt>Source</dt><dd>{current?.source || 'Unavailable'}</dd></div></dl>{selected.warnings.length ? <ul role="status">{selected.warnings.map((warning, warningIndex) => <li key={warningIndex}>{warning}</li>)}</ul> : null}</div> : <EmptyState title="No event selected" description="Choose an event from the timeline." />}</Card></div>
    </div> : null}
    <FeaturesBlock className="mt-8" />
  </>
}
