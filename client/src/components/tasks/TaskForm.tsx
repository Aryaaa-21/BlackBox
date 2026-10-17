import { FormEvent, useState } from 'react'
import { tasksApi } from '../../api'
import type { MissionMember, Task, TaskPriority } from '../../types'
import { entityName } from '../../lib/format'
import { Button, ErrorState, Field, Modal, SelectField, TextareaField } from '../ui'

interface TaskFormProps {
  missionId: string
  task?: Task
  members: MissionMember[]
  offline: boolean
  actorId: string
  onClose: () => void
  onSaved: (task: Task) => void
}

export function TaskForm({ missionId, task, members, offline, actorId, onClose, onSaved }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'MEDIUM')
  const [assignedTo, setAssignedTo] = useState(typeof task?.assignedTo === 'string' ? task.assignedTo : task?.assignedTo?.id || '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const context = { task, actorId, offline }
      let saved = task ? await tasksApi.update(task.id, { title, description, priority }, context) : await tasksApi.create(missionId, { title, description, priority, ...(assignedTo ? { assignedTo } : {}) }, context)
      if (task) {
        const previousAssignee = typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?.id || ''
        if (assignedTo && assignedTo !== previousAssignee) saved = await tasksApi.assign(saved.id, assignedTo, { ...context, task: saved })
        if (!assignedTo && previousAssignee) saved = await tasksApi.unassign(saved.id, { ...context, task: saved })
      }
      onSaved(saved)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save task')
    } finally {
      setSaving(false)
    }
  }

  return <Modal title={task ? 'Edit task' : 'Create task'} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="task-form" disabled={saving}>{saving ? 'Saving…' : !task && offline ? 'Save locally' : task ? 'Save changes' : 'Create task'}</Button></>}>
    <form id="task-form" onSubmit={submit}>
      {error ? <ErrorState message={error} /> : null}
      <Field label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <TextareaField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
      <SelectField label="Priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item}>{item}</option>)}</SelectField>
      <SelectField label="Assignee" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Unassigned</option>{members.filter((member) => member.status === 'ACTIVE' && member.role === 'FIELD_OPERATOR').map((member) => <option key={member.id} value={typeof member.userId === 'string' ? member.userId : member.userId.id}>{entityName(member.userId)}</option>)}</SelectField>
      {offline ? <p className="field__hint">Saved locally and queued for synchronization when connectivity returns.</p> : null}
    </form>
  </Modal>
}
