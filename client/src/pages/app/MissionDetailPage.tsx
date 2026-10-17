import { ArrowLeft, ClipboardList, Edit3, MessageSquare, Plus, Users, XCircle } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { eventsApi, membersApi, missionsApi, tasksApi, usersApi } from '../../api'
import { canUseOfflineCache } from '../../services/sync-policy'
import { EventTimeline, TaskRow } from '../../components/operations'
import { Button, Card, Drawer, EmptyState, ErrorState, Field, LoadingState, Modal, PriorityBadge, SelectField, StatusBadge, Table, TextareaField } from '../../components/ui'
import FeaturesBlock from '../../components/ui/features-4'
import { cacheEvent, cacheTask, createUuid, getCachedMission } from '../../db'
import { entityName, relativeDate, shortDate } from '../../lib/format'
import { useAuthStore } from '../../stores/auth.store'
import { useConnectivityStore } from '../../stores/connectivity.store'
import { useOperationsStore } from '../../stores/operations.store'
import { useSyncStore } from '../../stores/sync.store'
import { useRealtimeStore } from '../../stores/realtime.store'
import { TaskForm } from '../../components/tasks/TaskForm'
import type { Mission, MissionEvent, MissionMember, MissionSeverity, Task, TaskPriority, TaskStatus, User } from '../../types'

type DetailTab = 'overview' | 'tasks' | 'team' | 'activity'

export function MissionDetailPage() {
  const { missionId = '' } = useParams(); const navigate = useNavigate(); const user = useAuthStore((state) => state.user); const api = useConnectivityStore((state) => state.api); const browser = useConnectivityStore((state) => state.browser)
  const { missions, tasksByMission, membersByMission, eventsByMission, loadTasks, loadMembers, loadEvents, hydrateCache, upsertTask, upsertMember, upsertEvent, upsertMission } = useOperationsStore()
  const realtimeConnected = useRealtimeStore((state) => state.connected)
  const joinRealtimeMission = useRealtimeStore((state) => state.joinMission)
  const leaveRealtimeMission = useRealtimeStore((state) => state.leaveMission)
  const enqueue = useSyncStore((state) => state.enqueue); const conflicts = useSyncStore((state) => state.conflicts); const refreshConflicts = useSyncStore((state) => state.refresh); const resolveConflict = useSyncStore((state) => state.resolve)
  const [mission, setMission] = useState<Mission | null>(missions.find((item) => item.id === missionId) || null); const [tab, setTab] = useState<DetailTab>('overview'); const [loading, setLoading] = useState(!mission); const [error, setError] = useState<string | null>(null); const [taskForm, setTaskForm] = useState<{ task?: Task; open: boolean }>({ open: false }); const [taskDrawer, setTaskDrawer] = useState<Task | null>(null); const [observationOpen, setObservationOpen] = useState(false); const [memberOpen, setMemberOpen] = useState(false); const [conflictOpen, setConflictOpen] = useState(false); const [missionEditOpen, setMissionEditOpen] = useState(false)
  const tasks = tasksByMission[missionId] || []; const members = membersByMission[missionId] || []; const events = eventsByMission[missionId] || []; const canManage = user?.role === 'COMMANDER'; const offline = api !== 'reachable' || browser === 'offline'

  useEffect(() => {
    let active = true
    setLoading(true)
    // Cache hydration is best-effort and must not block the authoritative
    // mission request. A stuck IndexedDB/live-query operation previously left
    // the real browser on "Loading mission" even though the API and detail
    // data requests were healthy.
    void hydrateCache(missionId).then(async () => {
      const cached = useOperationsStore.getState().missions.find((item) => item.id === missionId) || await getCachedMission(missionId)
      if (active && cached) { setMission(cached); setLoading(false) }
    }).catch(() => undefined)
    void missionsApi.get(missionId).then((loaded) => {
      if (active) { setMission(loaded); upsertMission(loaded); setLoading(false) }
    }).catch(async (reason: unknown) => {
      const cached = canUseOfflineCache(reason) ? await getCachedMission(missionId) : undefined
      if (!active) return
      setMission(cached || null)
      if (!cached) setError(reason instanceof Error ? reason.message : 'Unable to load mission. No local copy exists.')
      setLoading(false)
    })
    return () => { active = false }
  }, [missionId, hydrateCache, upsertMission])
  useEffect(() => { if (!mission) return; void Promise.all([loadTasks(missionId), loadMembers(missionId), loadEvents(missionId, { limit: 100 })]).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load mission details')); void refreshConflicts(missionId).catch(() => undefined) }, [mission, missionId, loadTasks, loadMembers, loadEvents, refreshConflicts])
  useEffect(() => {
    if (!realtimeConnected) return
    void joinRealtimeMission(missionId).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to join mission realtime room'))
    return () => { leaveRealtimeMission(missionId) }
  }, [missionId, realtimeConnected, joinRealtimeMission, leaveRealtimeMission])
  if (loading) return <LoadingState label="Loading mission" />
  if (!mission) return <ErrorState message={error || 'Mission not found'} onRetry={() => navigate('/missions')} />

  const doMissionAction = async (operation: 'start' | 'complete' | 'cancel') => { try { const updated = await missionsApi[operation](mission.id); setMission(updated); upsertMission(updated) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Mission action failed') } }
  const changeTaskStatus = async (task: Task, status: TaskStatus) => {
    try { upsertTask(await tasksApi.updateStatus(task.id, status, { task, actorId: user?.id, offline })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update task') }
  }
  const recordObservation = async (text: string) => {
    try { upsertEvent(await eventsApi.recordObservation(missionId, { text }, offline)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to record observation'); throw reason }
  }

  return <>
    <div className="detail-header"><div><Link className="auth-back" to="/missions"><ArrowLeft size={15} />Back to missions</Link><h1>{mission.title}</h1><div className="detail-header__meta"><StatusBadge status={mission.status} /><PriorityBadge priority={mission.severity} /><span className="badge">{mission.location}</span></div></div><div className="detail-header__actions">{canManage ? <Button variant="ghost" disabled={offline} onClick={() => setMissionEditOpen(true)}><Edit3 size={14} />Edit</Button> : null}{canManage && mission.status === 'DRAFT' ? <><Button variant="secondary" disabled={offline} onClick={() => void doMissionAction('start')}>Start</Button><Button variant="ghost" disabled={offline} onClick={() => void doMissionAction('cancel')}>Cancel</Button></> : null}{canManage && mission.status === 'ACTIVE' ? <><Button variant="secondary" disabled={offline} onClick={() => void doMissionAction('complete')}>Complete</Button><Button variant="ghost" disabled={offline} onClick={() => void doMissionAction('cancel')}>Cancel</Button></> : null}<Link className="button button--ghost" to={`/missions/${mission.id}/replay`}>Replay</Link></div></div>
    {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}
    {conflicts.filter((item) => item.status === 'OPEN').length ? <div className="error-state"><XCircle size={17} /><span>{conflicts.filter((item) => item.status === 'OPEN').length} sync conflict needs review.</span><Button variant="ghost" onClick={() => setConflictOpen(true)}>Review conflicts</Button></div> : null}
    <div className="summary-grid"><Summary label="Status" value={mission.status} /><Summary label="Severity" value={mission.severity} /><Summary label="Location" value={mission.location} /><Summary label="Team" value={members.filter((member) => member.status === 'ACTIVE').length} /><Summary label="Tasks" value={tasks.length} /><Summary label="Updated" value={relativeDate(mission.updatedAt)} /></div>
    <div className="tabs" role="tablist">{(['overview', 'tasks', 'team', 'activity'] as DetailTab[]).map((item) => <button key={item} className={`tab ${tab === item ? 'tab--active' : ''}`} onClick={() => setTab(item)} role="tab" aria-selected={tab === item}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
    {tab === 'overview' ? <Overview mission={mission} /> : null}
    {tab === 'tasks' ? <TasksTab tasks={tasks} members={members} canManage={canManage} onNew={() => setTaskForm({ open: true })} onOpen={setTaskDrawer} onStatus={changeTaskStatus} /> : null}
    {tab === 'team' ? <TeamTab members={members} canManage={canManage && !offline} onAdd={() => setMemberOpen(true)} onRemove={async (member) => { try { const memberUserId = typeof member.userId === 'string' ? member.userId : member.userId.id; upsertMember(await membersApi.remove(missionId, memberUserId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to remove member') } }} /> : null}
    {tab === 'activity' ? <Card className="detail-panel"><div className="detail-panel__header"><h2>Activity timeline</h2><Button variant="secondary" onClick={() => setObservationOpen(true)}><MessageSquare size={15} />Record observation</Button></div><div className="detail-panel__body"><EventTimeline events={events} /></div></Card> : null}
    {tab !== 'activity' ? <div className="detail-panel__actions"><Button variant="secondary" onClick={() => setObservationOpen(true)}><MessageSquare size={15} />Record observation</Button></div> : null}
    {taskForm.open ? <TaskForm missionId={missionId} task={taskForm.task} members={members} offline={offline} actorId={user?.id || ''} onClose={() => setTaskForm({ open: false })} onSaved={(task) => { upsertTask(task); setTaskForm({ open: false }) }} /> : null}
    {taskDrawer ? <TaskDrawer task={taskDrawer} canManage={canManage} onClose={() => setTaskDrawer(null)} onEdit={() => { setTaskForm({ open: true, task: taskDrawer }); setTaskDrawer(null) }} onStatus={(status) => void changeTaskStatus(taskDrawer, status)} /> : null}
    {observationOpen ? <ObservationModal offline={offline} onClose={() => setObservationOpen(false)} onSave={async (text) => { await recordObservation(text); setObservationOpen(false) }} /> : null}
    {memberOpen ? <MemberModal missionId={missionId} onClose={() => setMemberOpen(false)} onSaved={(member) => { upsertMember(member); setMemberOpen(false) }} /> : null}
    {conflictOpen ? <ConflictModal conflict={conflicts.find((item) => item.status === 'OPEN')} onClose={() => setConflictOpen(false)} onResolve={async (resolution) => { const conflict = conflicts.find((item) => item.status === 'OPEN'); if (conflict) await resolveConflict(conflict.id, { resolution }); setConflictOpen(false) }} /> : null}
    {missionEditOpen ? <MissionEditModal mission={mission} onClose={() => setMissionEditOpen(false)} onSaved={(updated) => { setMission(updated); upsertMission(updated); setMissionEditOpen(false) }} /> : null}
    <FeaturesBlock className="mt-8" />
  </>
}

function Summary({ label, value }: { label: string; value: string | number }) { return <div className="summary-cell"><span>{label}</span><strong>{value}</strong></div> }

function MissionEditModal({ mission, onClose, onSaved }: { mission: Mission; onClose: () => void; onSaved: (mission: Mission) => void }) { const [title, setTitle] = useState(mission.title); const [description, setDescription] = useState(mission.description); const [location, setLocation] = useState(mission.location); const [severity, setSeverity] = useState<MissionSeverity>(mission.severity); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { onSaved(await missionsApi.update(mission.id, { title, description, location, severity })) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save mission') } finally { setSaving(false) } }; return <Modal title="Edit mission" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="mission-edit-form" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></>}><form id="mission-edit-form" onSubmit={submit}>{error ? <ErrorState message={error} /> : null}<Field label="Mission title" value={title} onChange={(event) => setTitle(event.target.value)} required /><TextareaField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} required /><Field label="Location" value={location} onChange={(event) => setLocation(event.target.value)} required /><SelectField label="Severity" value={severity} onChange={(event) => setSeverity(event.target.value as MissionSeverity)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item}>{item}</option>)}</SelectField></form></Modal> }

function Overview({ mission }: { mission: Mission }) { return <div className="detail-panel"><div className="detail-panel__header"><h2>Mission overview</h2></div><div className="detail-panel__body"><p className="description">{mission.description || 'No mission description recorded.'}</p><dl className="metadata-list" style={{ marginTop: 26 }}><div><dt>Created by</dt><dd>{entityName(mission.createdBy)}</dd></div><div><dt>Location</dt><dd>{mission.location}</dd></div><div><dt>Created at</dt><dd>{shortDate(mission.createdAt)}</dd></div><div><dt>Started at</dt><dd>{shortDate(mission.startedAt)}</dd></div><div><dt>Completed at</dt><dd>{shortDate(mission.completedAt)}</dd></div><div><dt>Last updated</dt><dd>{shortDate(mission.updatedAt)}</dd></div></dl></div></div> }

function TasksTab({ tasks, members, canManage, onNew, onOpen, onStatus }: { tasks: Task[]; members: MissionMember[]; canManage: boolean; onNew: () => void; onOpen: (task: Task) => void; onStatus: (task: Task, status: TaskStatus) => void }) { const [filter, setFilter] = useState<TaskStatus | ''>(''); const visible = filter ? tasks.filter((task) => task.status === filter) : tasks; return <Card className="detail-panel"><div className="detail-panel__header"><div><span className="eyebrow">Task management</span><h2>{visible.length} tasks</h2></div>{canManage ? <Button onClick={onNew}><Plus size={15} />New task</Button> : null}</div><div className="toolbar" style={{ padding: '14px 18px 0', marginBottom: 0 }}><SelectField label="Filter" value={filter} onChange={(event) => setFilter(event.target.value as TaskStatus | '')}><option value="">All statuses</option>{['PENDING', 'ACTIVE', 'BLOCKED', 'COMPLETED'].map((item) => <option key={item}>{item}</option>)}</SelectField></div>{visible.length ? <Table minWidth={780}><thead><tr><th>Task</th><th>Priority</th><th>Assignee</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>{visible.map((task) => <TaskRow key={task.id} task={task} onOpen={() => onOpen(task)} onStatus={(status) => onStatus(task, status)} />)}</tbody></Table> : <EmptyState title="No tasks assigned" description="Create a task when this mission has work ready to coordinate." action={canManage ? <Button onClick={onNew}><Plus size={15} />Create task</Button> : null} icon={<ClipboardList size={20} />} />}</Card> }

function TeamTab({ members, canManage, onAdd, onRemove }: { members: MissionMember[]; canManage: boolean; onAdd: () => void; onRemove: (member: MissionMember) => void }) { return <Card className="detail-panel"><div className="detail-panel__header"><div><span className="eyebrow">Mission roster</span><h2>{members.filter((member) => member.status === 'ACTIVE').length} active members</h2></div>{canManage ? <Button onClick={onAdd}><Plus size={15} />Assign operator</Button> : null}</div>{members.length ? <Table minWidth={620}><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{entityName(member.userId)}</strong></td><td>{member.role}</td><td><StatusBadge status={member.status} /></td><td>{shortDate(member.joinedAt)}</td><td className="table-actions">{canManage && member.role === 'FIELD_OPERATOR' && member.status === 'ACTIVE' ? <button className="button button--quiet" onClick={() => onRemove(member)}>Remove</button> : null}</td></tr>)}</tbody></Table> : <EmptyState title="No team members" description="Assign field operators to make the mission visible to the field." icon={<Users size={20} />} />}</Card> }

function LegacyTaskForm({ missionId, task, members, offline, actorId, enqueue, onClose, onSaved }: { missionId: string; task?: Task; members: MissionMember[]; offline: boolean; actorId: string; enqueue: (input: { missionId: string; operationType: 'CREATE_TASK'; entityType: 'TASK'; entityId: string; payload: Record<string, unknown>; actorId: string }) => Promise<unknown>; onClose: () => void; onSaved: (task: Task) => void }) { const [title, setTitle] = useState(task?.title || ''); const [description, setDescription] = useState(task?.description || ''); const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'MEDIUM'); const [assignedTo, setAssignedTo] = useState(typeof task?.assignedTo === 'string' ? task.assignedTo : task?.assignedTo?.id || ''); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { let saved: Task; if (!task && offline) { const now = new Date().toISOString(); saved = { id: `local-${createUuid()}`, missionId, title, description, priority, status: 'PENDING', assignedTo: assignedTo || null, createdBy: actorId, createdAt: now, updatedAt: now }; await cacheTask(saved); await enqueue({ missionId, operationType: 'CREATE_TASK', entityType: 'TASK', entityId: saved.id, payload: { title, description, priority, ...(assignedTo ? { assignedTo } : {}) }, actorId }); } else { saved = task ? await tasksApi.update(task.id, { title, description, priority }) : await tasksApi.create(missionId, { title, description, priority, ...(assignedTo ? { assignedTo } : {}) }); if (task) { const previous = typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?.id || ''; if (assignedTo && assignedTo !== previous) saved = await tasksApi.assign(task.id, assignedTo); if (!assignedTo && previous) saved = await tasksApi.unassign(task.id) } } onSaved(saved) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save task') } finally { setSaving(false) } }; return <Modal title={task ? 'Edit task' : 'Create task'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="task-form" disabled={saving}>{saving ? 'Saving…' : !task && offline ? 'Save locally' : task ? 'Save changes' : 'Create task'}</Button></>}><form id="task-form" onSubmit={submit}>{error ? <ErrorState message={error} /> : null}<Field label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required /><TextareaField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} /><SelectField label="Priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item}>{item}</option>)}</SelectField><SelectField label="Assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Unassigned</option>{members.filter((member) => member.status === 'ACTIVE' && member.role === 'FIELD_OPERATOR').map((member) => <option key={member.id} value={typeof member.userId === 'string' ? member.userId : member.userId.id}>{entityName(member.userId)}</option>)}</SelectField>{!task && offline ? <p className="field__hint">This task will be saved locally and synchronized when connectivity returns.</p> : null}</form></Modal> }

function TaskDrawer({ task, canManage, onClose, onEdit, onStatus }: { task: Task; canManage: boolean; onClose: () => void; onEdit: () => void; onStatus: (status: TaskStatus) => void }) { const next = task.status === 'PENDING' ? 'ACTIVE' : task.status === 'ACTIVE' ? 'COMPLETED' : task.status === 'BLOCKED' ? 'ACTIVE' : null; return <Drawer title="Task details" onClose={onClose} footer={<>{canManage ? <Button variant="ghost" onClick={onEdit}><Edit3 size={14} />Edit</Button> : null}{next ? <Button onClick={() => onStatus(next)}>{next === 'COMPLETED' ? 'Complete task' : next === 'ACTIVE' ? 'Start task' : next}</Button> : null}</>}><span className="eyebrow">{task.id}</span><h2 style={{ marginTop: 12, fontSize: 22, fontWeight: 500 }}>{task.title}</h2><div className="detail-header__meta"><PriorityBadge priority={task.priority} /><StatusBadge status={task.status} /></div><p className="description" style={{ marginTop: 24 }}>{task.description || 'No description recorded.'}</p><dl className="metadata-list" style={{ marginTop: 26 }}><div><dt>Assignee</dt><dd>{entityName(task.assignedTo)}</dd></div><div><dt>Created by</dt><dd>{entityName(task.createdBy)}</dd></div><div><dt>Created</dt><dd>{shortDate(task.createdAt)}</dd></div><div><dt>Updated</dt><dd>{shortDate(task.updatedAt)}</dd></div><div><dt>Started</dt><dd>{shortDate(task.startedAt)}</dd></div><div><dt>Completed</dt><dd>{shortDate(task.completedAt)}</dd></div></dl></Drawer> }

function ObservationModal({ offline, onClose, onSave }: { offline: boolean; onClose: () => void; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setSaving(true); setError(null)
    try { await onSave(text.trim()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to record observation') }
    finally { setSaving(false) }
  }
  return <Modal title="Record observation" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!text.trim() || saving} onClick={save}>{saving ? 'Saving…' : offline ? 'Save locally' : 'Save observation'}</Button></>}>
    {error ? <ErrorState message={error} /> : null}
    <TextareaField label="Observation" value={text} onChange={(event) => setText(event.target.value)} placeholder="Record what the team observed…" required />
    {offline ? <p className="field__hint">Saved locally now and queued for synchronization.</p> : null}
  </Modal>
}

function MemberModal({ missionId, onClose, onSaved }: { missionId: string; onClose: () => void; onSaved: (member: MissionMember) => void }) { const [query, setQuery] = useState(''); const [users, setUsers] = useState<User[]>([]); const [error, setError] = useState<string | null>(null); const search = async () => { try { setUsers(await usersApi.search({ role: 'FIELD_OPERATOR', search: query })) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to search users') } }; return <Modal title="Assign field operator" onClose={onClose}><Field label="Search by name or email" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search() } }} autoFocus />{error ? <ErrorState message={error} /> : null}<div className="stack" style={{ marginTop: 18 }}>{users.map((user) => <button key={user.id} className="member-option" onClick={async () => { try { onSaved(await membersApi.add(missionId, user.id)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to assign operator') } }}><span><strong>{user.name}</strong><small>{user.email}</small></span><Plus size={15} /></button>)}</div></Modal> }

function ConflictModal({ conflict, onClose, onResolve }: { conflict?: { localState: Record<string, unknown>; serverState: Record<string, unknown>; operationType: string }; onClose: () => void; onResolve: (resolution: 'KEEP_LOCAL' | 'KEEP_SERVER') => Promise<void> }) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  if (!conflict) return null
  const localStatus = String(conflict.localState.status || '—')
  const serverStatus = String(conflict.serverState.status || '—')
  const resolve = async (choice: 'KEEP_LOCAL' | 'KEEP_SERVER') => {
    setSaving(true); setError(null)
    try { await onResolve(choice) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to resolve conflict') }
    finally { setSaving(false) }
  }
  return <Modal title="Sync conflict" onClose={onClose}>
    {error ? <ErrorState message={error} /> : null}
    <p className="description">The server changed this record while your device was offline. Choose which version should remain authoritative.</p>
    <div className="split-grid" style={{ marginTop: 20 }}><div className="detail-panel"><div className="detail-panel__header"><h2>Local version</h2></div><div className="detail-panel__body"><StatusBadge status={localStatus} /></div></div><div className="detail-panel"><div className="detail-panel__header"><h2>Server version</h2></div><div className="detail-panel__body"><StatusBadge status={serverStatus} /></div></div></div>
    <div className="modal__footer" style={{ margin: '20px -22px -22px' }}><Button disabled={saving} variant="ghost" onClick={() => void resolve('KEEP_SERVER')}>Keep server</Button><Button disabled={saving} onClick={() => void resolve('KEEP_LOCAL')}>Keep local</Button></div>
  </Modal>
}
