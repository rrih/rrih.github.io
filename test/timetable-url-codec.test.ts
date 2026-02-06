import { describe, expect, it } from 'bun:test'
import { createTimetableFromTemplate } from '../src/lib/timetable/templates'
import { decodeTimetableFromSearch, encodeTimetableQuery } from '../src/lib/timetable/urlCodec'
import { setMergeSpan } from '../src/lib/timetable/utils'

describe('timetable URL codec', () => {
  it('round-trips timetable state through v=1&t= query', () => {
    let state = createTimetableFromTemplate('university')

    state.meta.title = '春学期 時間割'
    state.cells[1][1] = {
      ...state.cells[1][1],
      subject: '統計学',
      teacher: '永井教授',
      room: 'B201',
      memo: '毎週小テスト',
      color: '#123ABC',
    }
    state.overrides[1][1] = { start: '08:45', end: '10:15' }
    state = setMergeSpan(state, 1, 1, 2)

    const query = encodeTimetableQuery(state)
    const decoded = decodeTimetableFromSearch(query)

    expect(decoded.error).toBeNull()
    expect(decoded.state.meta.title).toBe('春学期 時間割')
    expect(decoded.state.cells[1][1]?.subject).toBe('統計学')
    expect(decoded.state.cells[1][1]?.teacher).toBe('永井教授')
    expect(decoded.state.cells[1][1]?.room).toBe('B201')
    expect(decoded.state.cells[1][1]?.memo).toBe('毎週小テスト')
    expect(decoded.state.cells[1][1]?.color).toBe('#123ABC')
    expect(decoded.state.overrides[1][1]?.start).toBe('08:45')
    expect(decoded.state.overrides[1][1]?.end).toBe('10:15')
    expect(decoded.state.merges[1][1]).toBe(2)
  })

  it('omits filters from shared query when shareFilters is disabled', () => {
    const state = createTimetableFromTemplate('junior-high')
    state.meta.shareFilters = false
    state.filters.query = '数学'
    state.filters.subject = '英語'
    state.filters.teacher = 'Smith先生'

    const decoded = decodeTimetableFromSearch(encodeTimetableQuery(state))

    expect(decoded.error).toBeNull()
    expect(decoded.state.filters.query).toBe('')
    expect(decoded.state.filters.subject).toBe('')
    expect(decoded.state.filters.teacher).toBe('')
  })

  it('returns fallback state with error for malformed payload', () => {
    const malformed = '?v=1&t=%%%invalid%%%'
    const decoded = decodeTimetableFromSearch(malformed, 'elementary')

    expect(decoded.error).not.toBeNull()
    expect(decoded.state.meta.template).toBe('elementary')
    expect(decoded.state.meta.periodCount).toBe(6)
  })
})
