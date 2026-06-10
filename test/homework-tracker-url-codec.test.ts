import { describe, expect, it } from 'bun:test'
import {
  createHomeworkTrackerPersonalState,
  createHomeworkTrackerState,
} from '../src/lib/homework-tracker/templates'
import {
  decodeHomeworkTrackerFromSearch,
  encodeHomeworkTrackerQuery,
} from '../src/lib/homework-tracker/urlCodec'
import {
  buildAssignmentViewModels,
  filterAssignmentViewModels,
  getSummaryCounts,
} from '../src/lib/homework-tracker/utils'

describe('homework tracker URL codec', () => {
  it('round-trips homework tracker state through v=1&h= query', () => {
    const state = createHomeworkTrackerState('high-school')

    state.title = '新学期の課題一覧'
    state.assignments.push({
      id: 'assignment-1',
      title: '英語ワーク 12ページまで',
      subjectId: state.subjects[1].id,
      type: 'homework',
      dueDate: '2026-04-03',
      dueTime: '08:30',
      note: '提出先はClassroom',
      room: '2-A',
      teacher: '佐藤先生',
      link: '',
      importance: 2,
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z',
    })

    const query = encodeHomeworkTrackerQuery(state)
    const decoded = decodeHomeworkTrackerFromSearch(query)

    expect(decoded.error).toBeNull()
    expect(decoded.state.title).toBe('新学期の課題一覧')
    expect(decoded.state.assignments[0]?.title).toBe('英語ワーク 12ページまで')
    expect(decoded.state.assignments[0]?.teacher).toBe('佐藤先生')
    expect(decoded.state.assignments[0]?.importance).toBe(2)
  })

  it('falls back with an error for malformed payload', () => {
    const decoded = decodeHomeworkTrackerFromSearch('?v=1&h=%%%invalid%%%')

    expect(decoded.error).not.toBeNull()
    expect(decoded.state.schoolType).toBe('high-school')
  })
})

describe('homework tracker derived views', () => {
  it('keeps completion local while filtering upcoming work', () => {
    const shared = createHomeworkTrackerState('high-school')
    const personal = createHomeworkTrackerPersonalState()

    shared.assignments = [
      {
        id: 'due-today',
        title: '数学プリント',
        subjectId: shared.subjects[0].id,
        type: 'submission',
        dueDate: '2026-03-28',
        dueTime: '23:59',
        note: '',
        room: '',
        teacher: '',
        link: '',
        importance: 3,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      },
      {
        id: 'next-week',
        title: '理科レポート',
        subjectId: shared.subjects[3].id,
        type: 'homework',
        dueDate: '2026-04-02',
        dueTime: '',
        note: '',
        room: '',
        teacher: '',
        link: '',
        importance: 1,
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z',
      },
    ]

    personal.completedIds = ['due-today']
    personal.tab = 'week'

    const items = buildAssignmentViewModels(shared, personal, new Date('2026-03-28T09:00:00.000Z'))
    const filtered = filterAssignmentViewModels(items, personal)
    const summary = getSummaryCounts(shared, personal, new Date('2026-03-28T09:00:00.000Z'))

    expect(filtered[0]?.assignment.id).toBe('next-week')
    expect(summary.today).toBe(0)
    expect(summary.week).toBe(1)
  })
})
