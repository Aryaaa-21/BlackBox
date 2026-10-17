import { Plus, Shield } from 'lucide-react'
import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { membersApi, missionsApi, tasksApi } from '../../api'
import { MissionRow } from '../../components/operations'
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, Modal, SelectField, SectionHeading, Table, TextareaField } from '../../components/ui'
import FeaturesBlock from '../../components/ui/features-4'
import type { Mission, MissionSeverity, MissionStatus } from '../../types'
import { useAuthStore } from '../../stores/auth.store'
import { useOperationsStore } from '../../stores/operations.store'
import { useConnectivityStore } from '../../stores/connectivity.store'

const severities: MissionSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const statuses: Array<MissionStatus | ''> = ['', 'DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']

export function MissionsPage() {
  const user = useAuthStore((state) => state.user)
  const browser = useConnectivityStore((state) => state.browser)
  const api = useConnectivityStore((state) => state.api)
  const { missions, loading, error, loadMissions, upsertMission } = useOperationsStore()
  const [search, setSearch] = useState(''); const [status, setStatus] = useState<MissionStatus | ''>(''); const [severity, setSeverity] = useState<MissionSeverity | ''>(''); const [formOpen, setFormOpen] = useState(false); const [editing, setEditing] = useState<Mission | null>(null); const [actionError, setActionError] = useState<string | null>(null); const [counts, setCounts] = useState<Record<string, { tasks: number; team: number }>>({})
  useEffect(() => { void loadMissions({ limit: 50, status: status || undefined, severity: severity || undefined, search: search || undefined }) }, [loadMissions, status, severity, search])
  useEffect(() => { if (!missions.length) return; void Promise.all(missions.map(async (mission) => { try { const [taskData, members] = await Promise.all([tasksApi.mission(mission.id, { limit: 1 }), membersApi.list(mission.id)]); return [mission.id, { tasks: taskData.pagination.total, team: members.filter((member) => member.status === 'ACTIVE').length }] as const } catch { return [mission.id, { tasks: 0, team: 0 }] as const } })).then((entries) => setCounts(Object.fromEntries(entries))) }, [missions])
  const visible = useMemo(() => search ? missions.filter((mission) => `${mission.title} ${mission.location}`.toLowerCase().includes(search.toLowerCase())) : missions, [missions, search])
  const canManage = user?.role === 'COMMANDER'
  const offline = browser === 'offline' || api === 'unreachable'
  const act = async (mission: Mission, operation: 'start' | 'complete' | 'cancel') => { if (offline) { setActionError('Mission lifecycle actions require a reachable server.'); return } setActionError(null); try { const updated = await missionsApi[operation](mission.id); upsertMission(updated) } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Mission action failed') } }
  return <>
    <SectionHeading eyebrow="Operations / Missions" title="Missions" description="Create, monitor, and move operational work through its defined lifecycle." action={canManage ? <Button disabled={offline} title={offline ? 'Mission creation requires a reachable server' : undefined} onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={16} />New mission</Button> : null} />
    <div className="toolbar"><Field label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or location" /><SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value as MissionStatus | '')}>{statuses.map((item) => <option key={item} value={item}>{item || 'All statuses'}</option>)}</SelectField><SelectField label="Severity" value={severity} onChange={(event) => setSeverity(event.target.value as MissionSeverity | '')}><option value="">All severity</option>{severities.map((item) => <option key={item}>{item}</option>)}</SelectField></div>
    {actionError ? <ErrorState message={actionError} /> : null}
    <Card>{loading && !missions.length ? <LoadingState label="Loading missions" /> : visible.length ? <Table minWidth={900}><thead><tr><th>Mission</th><th>Status</th><th>Severity</th><th>Location</th><th>Team</th><th>Tasks</th><th>Updated</th><th /></tr></thead><tbody>{visible.map((mission) => <Fragment key={mission.id}><MissionRow mission={mission} taskCount={counts[mission.id]?.tasks} teamCount={counts[mission.id]?.team} /><tr className="mission-actions-row"><td colSpan={8}><div className="table-actions"><Link className="table-link" to={`/missions/${mission.id}`}>Open</Link>{canManage && mission.status === 'DRAFT' ? <><button className="button button--quiet" disabled={offline} onClick={() => { setEditing(mission); setFormOpen(true) }}>Edit</button><button className="button button--quiet" disabled={offline} onClick={() => void act(mission, 'start')}>Start</button><button className="button button--quiet" disabled={offline} onClick={() => void act(mission, 'cancel')}>Cancel</button></> : null}{canManage && mission.status === 'ACTIVE' ? <button className="button button--quiet" disabled={offline} onClick={() => void act(mission, 'complete')}>Complete</button> : null}</div></td></tr></Fragment>)}</tbody></Table> : <EmptyState title="No missions yet" description={canManage ? 'Create your first mission to begin operations.' : 'You will see missions here when you are assigned as an active member.'} action={canManage ? <Button disabled={offline} onClick={() => setFormOpen(true)}><Plus size={15} />Create mission</Button> : null} icon={<Shield size={20} />} />}</Card>
    <FeaturesBlock className="mt-8" />
    {formOpen ? <MissionForm mission={editing} onClose={() => setFormOpen(false)} onSaved={(mission) => { upsertMission(mission); setFormOpen(false) }} /> : null}
  </>
}

function MissionForm({ mission, onClose, onSaved }: { mission: Mission | null; onClose: () => void; onSaved: (mission: Mission) => void }) {
  const [title, setTitle] = useState(mission?.title || ''); const [description, setDescription] = useState(mission?.description || ''); const [location, setLocation] = useState(mission?.location || ''); const [severity, setSeverity] = useState<MissionSeverity>(mission?.severity || 'MEDIUM'); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(null); try { const saved = mission ? await missionsApi.update(mission.id, { title, description, location, severity }) : await missionsApi.create({ title, description, location, severity }); onSaved(saved) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save mission') } finally { setSaving(false) } }
  return <Modal title={mission ? 'Edit mission' : 'Create mission'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="mission-form" disabled={saving}>{saving ? 'Saving…' : mission ? 'Save changes' : 'Create mission'}</Button></>}><form id="mission-form" onSubmit={submit}>{error ? <ErrorState message={error} /> : null}<Field label="Mission title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} /><TextareaField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} required /><Field label="Location" value={location} onChange={(event) => setLocation(event.target.value)} required /><SelectField label="Severity" value={severity} onChange={(event) => setSeverity(event.target.value as MissionSeverity)}>{severities.map((item) => <option key={item}>{item}</option>)}</SelectField></form></Modal>
}
