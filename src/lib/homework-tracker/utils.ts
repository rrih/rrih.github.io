import {
  cloneAssignment,
  cloneHomeworkTrackerPersonalState,
  cloneHomeworkTrackerState,
  createHomeworkTrackerPersonalState,
  createHomeworkTrackerState,
} from './templates'
import {
  ASSIGNMENT_TYPE_LABELS,
  type AssignmentDerivedStatus,
  type AssignmentViewModel,
  type HomeworkAssignment,
  type HomeworkSubject,
  type HomeworkTrackerPersonalState,
  type HomeworkTrackerSharedState,
} from './types'

function padTime(value: string) {
  return value.trim() ? value : '23:59'
}

export function getAssignmentDueDateTime(assignment: HomeworkAssignment): Date {
  return new Date(`${assignment.dueDate}T${padTime(assignment.dueTime)}:00`)
}

export function isSameCalendarDay(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  )
}

export function getAssignmentDerivedStatus(
  assignment: HomeworkAssignment,
  completedIds: Set<string>,
  now = new Date()
): AssignmentDerivedStatus {
  if (completedIds.has(assignment.id)) {
    return 'done'
  }

  const due = getAssignmentDueDateTime(assignment)

  if (due.getTime() < now.getTime()) {
    return 'overdue'
  }

  if (isSameCalendarDay(due, now)) {
    return 'today'
  }

  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(now.getDate() + 7)

  if (due.getTime() <= sevenDaysFromNow.getTime()) {
    return 'week'
  }

  return 'upcoming'
}

export function formatDueLabel(assignment: HomeworkAssignment, now = new Date()): string {
  const due = getAssignmentDueDateTime(assignment)
  const dateLabel = `${due.getMonth() + 1}/${due.getDate()}`
  const timeLabel = assignment.dueTime ? ` ${assignment.dueTime}` : ''

  if (isSameCalendarDay(due, now)) {
    return `今日 ${assignment.dueTime || ''}`.trim()
  }

  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)

  if (isSameCalendarDay(due, tomorrow)) {
    return `明日 ${assignment.dueTime || ''}`.trim()
  }

  return `${dateLabel}${timeLabel}`
}

export function buildAssignmentViewModels(
  sharedState: HomeworkTrackerSharedState,
  personalState: HomeworkTrackerPersonalState,
  now = new Date()
): AssignmentViewModel[] {
  const completedIds = new Set(personalState.completedIds)
  const subjectMap = new Map(sharedState.subjects.map((subject) => [subject.id, subject]))

  return sharedState.assignments
    .map((assignment) => {
      const subject = subjectMap.get(assignment.subjectId) ?? null
      return {
        assignment,
        subject,
        completed: completedIds.has(assignment.id),
        derivedStatus: getAssignmentDerivedStatus(assignment, completedIds, now),
        dueLabel: formatDueLabel(assignment, now),
        dueAt: getAssignmentDueDateTime(assignment).getTime(),
      }
    })
    .sort((left, right) => {
      if (left.completed !== right.completed) {
        return left.completed ? 1 : -1
      }

      if (left.dueAt !== right.dueAt) {
        return left.dueAt - right.dueAt
      }

      return right.assignment.importance - left.assignment.importance
    })
}

export function filterAssignmentViewModels(
  items: AssignmentViewModel[],
  personalState: HomeworkTrackerPersonalState
): AssignmentViewModel[] {
  const query = personalState.query.trim().toLowerCase()

  return items.filter((item) => {
    if (
      personalState.subjectId !== 'all' &&
      item.assignment.subjectId !== personalState.subjectId
    ) {
      return false
    }

    if (personalState.type !== 'all' && item.assignment.type !== personalState.type) {
      return false
    }

    if (query) {
      const haystack = [
        item.assignment.title,
        item.assignment.note,
        item.assignment.teacher,
        item.assignment.room,
        item.subject?.name ?? '',
      ]
        .join(' ')
        .toLowerCase()

      if (!haystack.includes(query)) {
        return false
      }
    }

    switch (personalState.tab) {
      case 'today':
        return item.derivedStatus === 'today' || item.derivedStatus === 'overdue'
      case 'week':
        return item.derivedStatus !== 'upcoming'
      default:
        return true
    }
  })
}

export function getSummaryCounts(
  sharedState: HomeworkTrackerSharedState,
  personalState: HomeworkTrackerPersonalState,
  now = new Date()
) {
  const completedIds = new Set(personalState.completedIds)
  let today = 0
  let week = 0
  let overdue = 0

  for (const assignment of sharedState.assignments) {
    const status = getAssignmentDerivedStatus(assignment, completedIds, now)

    if (status === 'today') {
      today += 1
    }

    if (status === 'today' || status === 'week') {
      week += 1
    }

    if (status === 'overdue') {
      overdue += 1
    }
  }

  return { today, week, overdue }
}

export function sanitizeHomeworkTrackerState(
  state: HomeworkTrackerSharedState | null | undefined
): HomeworkTrackerSharedState {
  if (!state) {
    return createHomeworkTrackerState()
  }

  const fallback = createHomeworkTrackerState(state.schoolType ?? 'high-school')
  const next = cloneHomeworkTrackerState({
    ...fallback,
    ...state,
    version: 1,
  })

  if (next.subjects.length === 0) {
    next.subjects = fallback.subjects
  }

  const subjectIds = new Set(next.subjects.map((subject) => subject.id))

  next.assignments = next.assignments
    .map((assignment) => {
      const nowIso = new Date().toISOString()
      return cloneAssignment({
        ...assignment,
        id: assignment.id || crypto.randomUUID(),
        title: assignment.title?.trim() || '無題の課題',
        subjectId: subjectIds.has(assignment.subjectId)
          ? assignment.subjectId
          : next.subjects[0]?.id || 'subject-1',
        type: assignment.type ?? 'homework',
        dueDate: assignment.dueDate || new Date().toISOString().slice(0, 10),
        dueTime: assignment.dueTime || '',
        note: assignment.note || '',
        room: assignment.room || '',
        teacher: assignment.teacher || '',
        link: assignment.link || '',
        importance: assignment.importance ?? 1,
        createdAt: assignment.createdAt || nowIso,
        updatedAt: assignment.updatedAt || nowIso,
      })
    })
    .sort(
      (left, right) =>
        getAssignmentDueDateTime(left).getTime() - getAssignmentDueDateTime(right).getTime()
    )

  return next
}

export function sanitizeHomeworkTrackerPersonalState(
  state: HomeworkTrackerPersonalState | null | undefined,
  sharedState: HomeworkTrackerSharedState
): HomeworkTrackerPersonalState {
  const fallback = createHomeworkTrackerPersonalState()

  if (!state) {
    return fallback
  }

  const next = cloneHomeworkTrackerPersonalState({
    ...fallback,
    ...state,
  })

  const assignmentIds = new Set(sharedState.assignments.map((assignment) => assignment.id))
  const subjectIds = new Set(sharedState.subjects.map((subject) => subject.id))

  next.completedIds = next.completedIds.filter((id) => assignmentIds.has(id))

  if (next.subjectId !== 'all' && !subjectIds.has(next.subjectId)) {
    next.subjectId = 'all'
  }

  return next
}

export function createBlankAssignment(subjectId: string): HomeworkAssignment {
  const now = new Date()
  const dueDate = now.toISOString().slice(0, 10)
  const iso = now.toISOString()

  return {
    id: crypto.randomUUID(),
    title: '',
    subjectId,
    type: 'homework',
    dueDate,
    dueTime: '',
    note: '',
    room: '',
    teacher: '',
    link: '',
    importance: 1,
    createdAt: iso,
    updatedAt: iso,
  }
}

export function getAssignmentTypeLabel(type: HomeworkAssignment['type']) {
  return ASSIGNMENT_TYPE_LABELS[type]
}
