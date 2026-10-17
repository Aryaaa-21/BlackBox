import { Activity, ClipboardList, Users, Wifi } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorState, LoadingState, SectionHeading, Table } from '../../components/ui'
import { EventTimeline, MissionRow } from '../../components/operations'
import FeaturesBlock from '../../components/ui/features-4'
import { tasksApi } from '../../api'
import { useOperationsStore } from '../../stores/operations.store'
import { useSyncStore } from '../../stores/sync.store'
import { useConnectivityStore } from '../../stores/connectivity.store'
import { useRealtimeStore } from '../../stores/realtime.store'
import { relativeDate } from '../../lib/format'

export function DashboardPage() {
  const { missions, missionStats, tasksByMission, eventsByMission, membersByMission, loadMissions, loadMissionStats, loadTasks, loadEvents, loadMembers, loading, error } = useOperationsStore()
  const pendingCount = useSyncStore((state) => state.pendingCount)
  const conflicts = useSyncStore((state) => state.conflicts)
  const browser = useConnectivityStore((state) => state.browser)
  const api = useConnectivityStore((state) => state.api)
  const socket = useRealtimeStore((state) => state.connected)
  const [taskStats, setTaskStats] = useState<{ total: number; pending: number; active: number; blocked: number; completed: number } | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([loadMissions({ limit: 50 }), loadMissionStats().catch(() => null), tasksApi.stats().catch(() => null)]).then(([, , stats]) => setTaskStats(stats)).catch((reason) => setLocalError(reason instanceof Error ? reason.message : 'Unable to load dashboard'))
  }, [loadMissions, loadMissionStats])
  useEffect(() => {
    const active = missions.filter((mission) => mission.status === 'ACTIVE').slice(0, 6)
    void Promise.all(active.flatMap((mission) => [loadTasks(mission.id, { limit: 100 }), loadEvents(mission.id, { limit: 8 }), loadMembers(mission.id)])).catch(() => undefined)
  }, [missions, loadTasks, loadEvents, loadMembers])

  const activity = useMemo(() => Object.values(eventsByMission).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [eventsByMission])
  const operatorCount = useMemo(() => Object.values(membersByMission).flat().filter((member) => member.role === 'FIELD_OPERATOR' && member.status === 'ACTIVE').length, [membersByMission])
  const activeMissions = missions.filter((mission) => mission.status === 'ACTIVE')
  const connectionText = browser === 'offline' || api === 'unreachable' ? 'OFFLINE' : api === 'reachable' ? 'ONLINE' : 'CHECKING'

  if ((loading && !missions.length) && !localError) return <LoadingState label="Loading operational overview" />
  if (error || localError) return <ErrorState message={error || localError || 'Unable to load dashboard'} onRetry={() => { setLocalError(null); void loadMissions({ limit: 50 }) }} />

  return <>
    <SectionHeading eyebrow="Operations / Overview" title="Dashboard" description="A current view of missions, task load, field presence, and synchronization." />
    <div className="metric-grid">
      <Card><span className="metric-card__label"><Wifi size={15} />Active missions</span><strong>{missionStats?.active ?? activeMissions.length}</strong><small>{missionStats?.total ?? missions.length} missions in scope</small></Card>
      <Card><span className="metric-card__label"><ClipboardList size={15} />Open tasks</span><strong>{taskStats ? taskStats.pending + taskStats.active + taskStats.blocked : '—'}</strong><small>{taskStats?.blocked ?? 0} blocked</small></Card>
      <Card><span className="metric-card__label"><Users size={15} />Field operators</span><strong>{operatorCount || '—'}</strong><small>Active members in loaded missions</small></Card>
      <Card><span className="metric-card__label"><Activity size={15} />Pending sync</span><strong>{pendingCount}</strong><small>{conflicts.length ? `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} need review` : 'Local changes queued'}</small></Card>
    </div>

    <div className="dashboard-grid">
      <Card><div className="card__header"><div><span className="eyebrow">Active missions</span><h2>Operational work in progress</h2></div><Link className="table-link" to="/missions">View all</Link></div>
        {activeMissions.length ? <Table minWidth={820}><thead><tr><th>Mission</th><th>Status</th><th>Severity</th><th>Location</th><th>Team</th><th>Tasks</th><th>Updated</th></tr></thead><tbody>{activeMissions.map((mission) => <MissionRow key={mission.id} mission={mission} taskCount={tasksByMission[mission.id]?.length} teamCount={membersByMission[mission.id]?.length} />)}</tbody></Table> : <EmptyState title="No active missions" description="Start a draft mission when an operation is ready to move into the field." icon={<Wifi size={20} />} />}
      </Card>
      <Card className="dashboard-grid__side"><div className="card__header"><div><span className="eyebrow">System status</span><h2>Connection state</h2></div></div><div className="detail-panel__body replay-state"><div className="replay-state__line"><span>Connectivity</span><strong>{connectionText}</strong></div><div className="replay-state__line"><span>Server</span><strong>{api === 'reachable' ? 'AVAILABLE' : api === 'unreachable' ? 'UNAVAILABLE' : 'CHECKING'}</strong></div><div className="replay-state__line"><span>Socket</span><strong>{socket ? 'CONNECTED' : 'DISCONNECTED'}</strong></div><div className="replay-state__line"><span>Last sync</span><strong>{pendingCount ? `${pendingCount} pending` : 'Clear'}</strong></div></div></Card>
    </div>
    <Card className="detail-panel"><div className="card__header"><div><span className="eyebrow">Recent activity</span><h2>Mission event stream</h2></div><Activity size={16} color="var(--signal)" /></div><div className="detail-panel__body"><EventTimeline events={activity} /></div></Card>
    <FeaturesBlock className="mt-8" />
  </>
}
