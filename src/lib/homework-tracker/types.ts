export type SchoolType = 'junior-high' | 'high-school' | 'university' | 'custom'

export type HomeworkTab = 'today' | 'week' | 'all'

export type AssignmentType = 'homework' | 'submission' | 'exam' | 'bring' | 'notice'

export type AssignmentImportance = 1 | 2 | 3

export type AssignmentDerivedStatus = 'done' | 'overdue' | 'today' | 'week' | 'upcoming'

export interface HomeworkSubject {
  id: string
  name: string
  color: string
}

export interface HomeworkAssignment {
  id: string
  title: string
  subjectId: string
  type: AssignmentType
  dueDate: string
  dueTime: string
  note: string
  room: string
  teacher: string
  link: string
  importance: AssignmentImportance
  createdAt: string
  updatedAt: string
}

export interface HomeworkTrackerSharedState {
  version: 1
  title: string
  schoolType: SchoolType
  subjects: HomeworkSubject[]
  assignments: HomeworkAssignment[]
}

export interface HomeworkTrackerPersonalState {
  tab: HomeworkTab
  query: string
  subjectId: string | 'all'
  type: AssignmentType | 'all'
  showCompleted: boolean
  completedIds: string[]
}

export interface HomeworkTrackerPersistedState {
  shared: HomeworkTrackerSharedState
  personal: HomeworkTrackerPersonalState
}

export interface HomeworkTrackerCodecResult {
  state: HomeworkTrackerSharedState
  error: string | null
}

export interface AssignmentViewModel {
  assignment: HomeworkAssignment
  subject: HomeworkSubject | null
  completed: boolean
  derivedStatus: AssignmentDerivedStatus
  dueLabel: string
  dueAt: number
}

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  homework: '宿題',
  submission: '提出物',
  exam: 'テスト',
  bring: '持ち物',
  notice: '連絡',
}

export const IMPORTANCE_LABELS: Record<AssignmentImportance, string> = {
  1: '通常',
  2: '重要',
  3: '最重要',
}
