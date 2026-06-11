import { describe, expect, it } from 'bun:test'
import {
  applySafeGrowthActions,
  renderRelatedToolConfig,
  selectTargetToolIds,
  toolIdFromUrl,
} from '../scripts/growth/safe-growth-actions'

describe('safe growth actions', () => {
  it('extracts known tool ids from production tool URLs only', () => {
    expect(toolIdFromUrl('https://rrih.github.io/tools/animation-generator/')).toBe(
      'animation-generator'
    )
    expect(toolIdFromUrl('https://rrih.github.io/blog/example/')).toBeNull()
    expect(toolIdFromUrl('https://example.com/tools/animation-generator/')).toBeNull()
  })

  it('selects tool pages with search impressions as targets', () => {
    const targets = selectTargetToolIds([
      {
        keys: ['https://rrih.github.io/tools/animation-generator/'],
        clicks: 2,
        impressions: 660,
        ctr: 0.003,
        position: 28,
      },
      {
        keys: ['https://rrih.github.io/tools/gradient-generator/'],
        clicks: 0,
        impressions: 431,
        ctr: 0,
        position: 35,
      },
      {
        keys: ['https://rrih.github.io/tools/markdown-editor/'],
        clicks: 0,
        impressions: 15,
        ctr: 0,
        position: 77,
      },
      {
        keys: ['https://rrih.github.io/about/'],
        clicks: 0,
        impressions: 999,
        ctr: 0,
        position: 3,
      },
    ])

    expect(targets).toEqual(['animation-generator', 'gradient-generator', 'markdown-editor'])
  })

  it('adds deterministic related links without overwriting existing links', () => {
    const metrics = JSON.stringify({
      searchConsole: {
        topPages: [
          {
            keys: ['https://rrih.github.io/tools/animation-generator/'],
            clicks: 2,
            impressions: 660,
            ctr: 0.003,
            position: 28,
          },
        ],
      },
    })
    const config =
      "export const relatedToolIdsByToolId = {\n  'animation-generator': ['gradient-generator'],\n} as const satisfies Record<string, readonly string[]>\n"

    const plan = applySafeGrowthActions(metrics, config)

    expect(plan.changed).toBe(true)
    expect(plan.relatedToolIdsByToolId['animation-generator']).toEqual([
      'color-picker',
      'gradient-generator',
      'box-shadow-generator',
    ])
  })

  it('renders an empty config safely', () => {
    expect(renderRelatedToolConfig({})).toContain('relatedToolIdsByToolId:')
  })
})
