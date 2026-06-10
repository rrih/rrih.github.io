import type {
  HomeworkAssignment,
  HomeworkSubject,
  HomeworkTrackerPersonalState,
  HomeworkTrackerSharedState,
  SchoolType,
} from './types'

const TEMPLATE_SUBJECTS: Record<SchoolType, HomeworkSubject[]> = {
  'junior-high': [
    { id: 'jp', name: '国語', color: '#2563EB' },
    { id: 'math', name: '数学', color: '#7C3AED' },
    { id: 'eng', name: '英語', color: '#0891B2' },
    { id: 'sci', name: '理科', color: '#059669' },
    { id: 'soc', name: '社会', color: '#EA580C' },
  ],
  'high-school': [
    { id: 'math', name: '数学', color: '#7C3AED' },
    { id: 'eng', name: '英語', color: '#0891B2' },
    { id: 'jp', name: '現代文', color: '#2563EB' },
    { id: 'sci', name: '理科', color: '#059669' },
    { id: 'soc', name: '社会', color: '#EA580C' },
  ],
  university: [
    { id: 'seminar', name: 'ゼミ', color: '#2563EB' },
    { id: 'report', name: 'レポート', color: '#7C3AED' },
    { id: 'language', name: '語学', color: '#0891B2' },
    { id: 'major', name: '専門科目', color: '#059669' },
    { id: 'general', name: '一般教養', color: '#EA580C' },
  ],
  custom: [
    { id: 'subject-1', name: '科目1', color: '#2563EB' },
    { id: 'subject-2', name: '科目2', color: '#7C3AED' },
  ],
}

const TEMPLATE_TITLES: Record<SchoolType, string> = {
  'junior-high': '中学生の課題ボード',
  'high-school': '高校生の課題ボード',
  university: '大学の課題・提出物ボード',
  custom: '課題・提出物ボード',
}

export function createHomeworkTrackerState(
  schoolType: SchoolType = 'high-school'
): HomeworkTrackerSharedState {
  return {
    version: 1,
    title: TEMPLATE_TITLES[schoolType],
    schoolType,
    subjects: cloneSubjects(TEMPLATE_SUBJECTS[schoolType]),
    assignments: [],
  }
}

export function createHomeworkTrackerPersonalState(): HomeworkTrackerPersonalState {
  return {
    tab: 'today',
    query: '',
    subjectId: 'all',
    type: 'all',
    showCompleted: false,
    completedIds: [],
  }
}

export function cloneHomeworkTrackerState(
  state: HomeworkTrackerSharedState
): HomeworkTrackerSharedState {
  return {
    ...state,
    subjects: cloneSubjects(state.subjects),
    assignments: state.assignments.map(cloneAssignment),
  }
}

export function cloneHomeworkTrackerPersonalState(
  state: HomeworkTrackerPersonalState
): HomeworkTrackerPersonalState {
  return {
    ...state,
    completedIds: [...state.completedIds],
  }
}

export function cloneSubjects(subjects: HomeworkSubject[]): HomeworkSubject[] {
  return subjects.map((subject) => ({ ...subject }))
}

export function cloneAssignment(assignment: HomeworkAssignment): HomeworkAssignment {
  return { ...assignment }
}
