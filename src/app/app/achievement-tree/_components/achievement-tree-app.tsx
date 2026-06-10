'use client'

import { hierarchy, tree } from 'd3-hierarchy'
import {
  ChevronRight,
  Copy,
  LayoutGrid,
  Link as LinkIcon,
  ListChecks,
  Plus,
  Redo2,
  RefreshCw,
  Share2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

const STYLE_TEXT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');

:host {
  all: initial;
  display: block;
  min-height: 100vh;
  width: 100%;
  font-family: 'Space Grotesk', 'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif;
  color: #0b0e14;
  background: #f7f1e8;
  -webkit-font-smoothing: antialiased;
}
:host {
  --unit: 8px;
  --ink: #0b0e14;
  --ink-soft: #3f4654;
  --paper: #fff6e8;
  --paper-2: #f2e7d7;
  --paper-3: #f9f4ec;
  --accent: #f24b1a;
  --accent-2: #f7b500;
  --success: #1ba35e;
  --warn: #f7b500;
  --danger: #e04545;
  --sky: #5cc0ff;
  --hud: #0d121b;
  --grid: rgba(15, 18, 26, 0.08);
  --shadow: rgba(15, 18, 26, 0.22);
}
* {
  box-sizing: border-box;
}
*::before,
*::after {
  box-sizing: border-box;
}
h1, h2, h3, h4, h5, h6, p, ul, ol, li {
  margin: 0;
  padding: 0;
}
ul, ol {
  list-style: none;
}
button, input, select {
  font-family: inherit;
  font-size: 14px;
  border: none;
  outline: none;
}
button {
  cursor: pointer;
  background: transparent;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
input {
  background: transparent;
  color: inherit;
}
.app-root {
  min-height: 100vh;
  padding: 24px;
  background: radial-gradient(circle at 10% 10%, #fff9ef 0%, #f5efe6 35%, #e9f1ff 100%);
  display: grid;
  gap: 24px;
}
.surface {
  background: var(--paper);
  border: 2px solid var(--ink);
  box-shadow: 8px 8px 0 var(--shadow);
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
}
.command-bar {
  position: sticky;
  top: 16px;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  backdrop-filter: blur(6px);
}
.command-bar.surface {
  background: rgba(255, 246, 232, 0.92);
}
.brand {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 200px;
}
.title-input {
  font-size: 20px;
  font-weight: 700;
  min-width: 200px;
  padding: 8px 0;
  border-bottom: 2px solid var(--ink);
}
.title-input:focus {
  border-color: var(--accent);
}
.meta-pill {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--ink);
  color: var(--paper);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
.view-switch {
  display: inline-flex;
  gap: 8px;
  padding: 8px;
  border: 2px solid var(--ink);
  background: var(--paper-2);
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
}
.view-switch button {
  height: 40px;
  padding: 0 16px;
  border: 2px solid transparent;
  font-weight: 600;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
.view-switch button.active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}
.action-cluster {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.sig-btn {
  height: 40px;
  padding: 0 16px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--ink);
  color: var(--paper);
  border: 2px solid var(--ink);
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%);
  transition: transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sig-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 0 rgba(15, 18, 26, 0.12);
}
.sig-btn:active {
  transform: translateY(1px);
}
.sig-btn.ghost {
  background: transparent;
  color: var(--ink);
}
.sig-btn.accent {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.sig-btn.warn {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}
.sig-btn.icon {
  width: 40px;
  padding: 0;
  justify-content: center;
}
.main {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr);
}
.main.full {
  grid-template-columns: 1fr;
}
.map-stage {
  position: relative;
  min-height: 560px;
  background: radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.1) 40%), linear-gradient(0deg, var(--paper-3), var(--paper));
  border: 2px solid var(--ink);
  box-shadow: 10px 10px 0 var(--shadow);
  clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px));
  overflow: hidden;
}
.map-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(90deg, var(--grid) 1px, transparent 1px), linear-gradient(var(--grid) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.35;
  pointer-events: none;
}
.map-svg {
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}
.map-stage.dragging .map-svg {
  cursor: grabbing;
}
g[data-node='true'] {
  cursor: pointer;
}
g[data-node='true']:hover .node-rect {
  stroke: var(--ink);
  stroke-width: 2px;
}
.node-rect {
  fill: #fffdf7;
  stroke: #1a1f2a;
  stroke-width: 1.6px;
}
.node-rect.selected {
  stroke: var(--accent);
  stroke-width: 2.6px;
}
.node-rect.path {
  stroke: var(--accent-2);
}
.node-rect.flash {
  animation: nodeFlash 0.45s ease;
}
@keyframes nodeFlash {
  0% { fill: #fff0da; }
  50% { fill: #fff7ef; }
  100% { fill: #fffdf7; }
}
.node-title {
  font-size: 14px;
  font-weight: 600;
  fill: #0b0e14;
  pointer-events: none;
}
.node-status {
  font-size: 11px;
  fill: #4b5160;
  pointer-events: none;
}
.node-pill {
  fill: #a6b0bf;
}
.node-pill.todo { fill: #a3b2c7; }
.node-pill.doing { fill: var(--accent-2); }
.node-pill.done { fill: var(--success); }
.node-pill.paused { fill: var(--sky); }
.link-line {
  stroke: #c7b7a2;
  stroke-width: 1.4px;
  fill: none;
}
.link-line.path {
  stroke: var(--accent);
  stroke-width: 2px;
}
.node-action {
  fill: var(--ink);
  stroke: var(--ink);
  stroke-width: 1px;
  cursor: pointer;
}
.node-action-text {
  font-size: 14px;
  fill: var(--paper);
  pointer-events: none;
  font-weight: 700;
}
.node-input {
  width: 100%;
  height: 100%;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 16px;
  border-bottom: 2px solid var(--ink);
  background: transparent;
  color: var(--ink);
}
.map-hint {
  position: absolute;
  right: 24px;
  bottom: 24px;
  background: var(--ink);
  color: var(--paper);
  padding: 8px 16px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
  z-index: 2;
}
.root-add {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 2;
}
.node-dock {
  position: absolute;
  z-index: 3;
  min-width: 240px;
  display: grid;
  gap: 8px;
  padding: 16px;
  background: var(--paper);
  border: 2px solid var(--ink);
  box-shadow: 8px 8px 0 var(--shadow);
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
}
.node-dock::after {
  content: '';
  position: absolute;
  top: -8px;
  left: 24px;
  width: 16px;
  height: 16px;
  background: var(--paper);
  border-left: 2px solid var(--ink);
  border-top: 2px solid var(--ink);
  transform: rotate(45deg);
}
.dock-title {
  font-size: 14px;
  font-weight: 700;
}
.dock-meta {
  font-size: 11px;
  color: var(--ink-soft);
}
.status-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.status-chip {
  height: 40px;
  padding: 0 16px;
  border: 2px solid var(--ink);
  font-weight: 700;
  background: transparent;
  color: var(--ink);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
.status-chip.active {
  background: var(--ink);
  color: var(--paper);
}
.dock-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tag-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  min-height: 40px;
  background: var(--paper-2);
  border: 1px solid var(--ink);
  font-size: 11px;
  font-weight: 600;
}
.tag-chip button {
  width: 32px;
  height: 32px;
  font-weight: 700;
  border: 1px solid var(--ink);
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--paper);
}
.tag-input {
  height: 40px;
  border-bottom: 2px solid var(--ink);
  font-size: 12px;
}
.section-title {
  font-size: 18px;
  font-weight: 700;
}
.explore-grid {
  display: grid;
  gap: 16px;
}
.discovery-row {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.discovery-card {
  background: var(--paper);
  border: 2px solid var(--ink);
  padding: 16px;
  display: grid;
  gap: 8px;
  box-shadow: 6px 6px 0 var(--shadow);
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
}
.discovery-card button {
  height: 40px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 700;
  background: var(--ink);
  color: var(--paper);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
.suggestion-board {
  background: var(--paper-2);
  border: 2px dashed var(--ink);
  padding: 16px;
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
  display: grid;
  gap: 8px;
}
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip-row button {
  height: 40px;
  padding: 0 16px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
.timeline {
  display: grid;
  gap: 16px;
}
.timeline-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 2px solid var(--ink);
  background: var(--paper);
  box-shadow: 6px 6px 0 var(--shadow);
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
}
.timeline-item button {
  height: 40px;
  padding: 0 16px;
  font-size: 12px;
  font-weight: 700;
  background: var(--ink);
  color: var(--paper);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}
.metric {
  background: var(--paper-2);
  border: 2px solid var(--ink);
  padding: 16px;
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
}
.metric p {
  font-size: 11px;
  color: var(--ink-soft);
}
.metric strong {
  font-size: 20px;
  color: var(--ink);
}
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--paper);
  padding: 8px 16px;
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%);
  box-shadow: 0 10px 24px rgba(15, 18, 26, 0.2);
  z-index: 8;
  font-size: 12px;
}
.json-view {
  background: #0b1324;
  color: #e2e8f0;
  padding: 24px;
  border: 2px solid #0b0e14;
  font-size: 12px;
  line-height: 1.6;
}
.share-card {
  background: var(--paper);
  border: 2px solid var(--ink);
  padding: 24px;
  display: grid;
  gap: 16px;
  box-shadow: 10px 10px 0 var(--shadow);
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px));
}
.share-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hud {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 6;
  width: 240px;
  padding: 16px;
  background: var(--hud);
  color: var(--paper);
  border: 2px solid #1f2531;
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
  box-shadow: 10px 10px 0 rgba(12, 16, 24, 0.4);
}
.hud-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.hud-status {
  font-weight: 700;
}
.gauge {
  position: relative;
  width: 200px;
  height: 112px;
  margin: 0 auto;
}
.gauge svg {
  width: 100%;
  height: 100%;
}
.gauge-needle {
  position: absolute;
  width: 4px;
  height: 72px;
  background: var(--accent);
  left: 50%;
  bottom: 8px;
  transform-origin: 50% 100%;
  transform: translateX(-50%) rotate(var(--needle));
  transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.gauge-center {
  position: absolute;
  width: 16px;
  height: 16px;
  background: var(--paper);
  border: 2px solid var(--ink);
  border-radius: 50%;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
}
.hud-readout {
  display: grid;
  gap: 2px;
  text-align: center;
  margin-top: 8px;
}
.hud-readout strong {
  font-size: 18px;
}
.hud-readout span {
  font-size: 11px;
  color: #cbd5f5;
}
.hud-warning {
  animation: hudPulse 2.2s ease-in-out infinite;
}
@keyframes hudPulse {
  0% { box-shadow: 10px 10px 0 rgba(242, 75, 26, 0.15); }
  50% { box-shadow: 10px 10px 0 rgba(242, 75, 26, 0.4); }
  100% { box-shadow: 10px 10px 0 rgba(242, 75, 26, 0.15); }
}
.hud .shrink-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}
.shrink-card {
  background: rgba(255, 255, 255, 0.08);
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: grid;
  gap: 8px;
}
.shrink-card h5 {
  font-size: 12px;
  margin: 0;
}
.shrink-card p {
  font-size: 11px;
  margin: 0;
  color: #d7dbe8;
}
.shrink-card button {
  height: 32px;
  font-size: 11px;
  font-weight: 700;
  background: var(--accent-2);
  color: #111827;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%);
}
@media (max-width: 960px) {
  .app-root {
    padding: 16px;
  }
  .command-bar {
    position: static;
    flex-direction: column;
    align-items: stretch;
  }
  .brand {
    flex-wrap: wrap;
  }
  .action-cluster {
    justify-content: flex-start;
  }
  .hud {
    right: 16px;
    top: 16px;
    width: 200px;
  }
  .gauge {
    width: 170px;
  }
}
`

type Status = 0 | 1 | 2 | 3

type ViewMode = 'map' | 'explore' | 'timeline'

interface NodeItem {
  i: string
  p: string
  t: string
  s: Status
  d?: string
  g?: string[]
  c?: 0 | 1
}

interface TreeData {
  meta: {
    title?: string
  }
  nodes: NodeItem[]
}

interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

interface LayoutNode {
  id: string
  data: NodeItem
  x: number
  y: number
  depth: number
  parentId?: string
}

interface LayoutResult {
  nodes: LayoutNode[]
  links: { source: LayoutNode; target: LayoutNode }[]
  positions: Map<string, { x: number; y: number }>
}

type NestedLayoutNode = NodeItem & { children?: NestedLayoutNode[] }

const SCHEMA_VERSION = 1
const MAX_HISTORY = 50
const SOFT_LIMIT = 2000
const HARD_LIMIT = 8000
const DANGER_LIMIT = 12000

const STATUS_LABELS: Record<Status, string> = {
  0: 'todo',
  1: 'doing',
  2: 'done',
  3: 'paused',
}

const STATUS_NAMES: Record<Status, string> = {
  0: 'Todo',
  1: 'Doing',
  2: 'Done',
  3: 'Paused',
}

const DEFAULT_DATA: TreeData = {
  meta: {
    title: '人生達成ツリー',
  },
  nodes: [
    { i: 'a', p: '', t: '健康', s: 1 },
    { i: 'b', p: 'a', t: '運動習慣', s: 0 },
    { i: 'c', p: 'a', t: '睡眠改善', s: 0 },
    { i: 'd', p: '', t: 'キャリア', s: 1 },
    { i: 'e', p: 'd', t: '専門性', s: 1 },
    { i: 'f', p: 'e', t: '資格取得', s: 0 },
    { i: 'g', p: 'd', t: '作品発信', s: 0 },
  ],
}

const ADJACENT_TEMPLATES: Array<{ keywords: string[]; suggestions: string[] }> = [
  {
    keywords: ['資格', '試験', '検定'],
    suggestions: ['学習計画', '模試', '受験', '合格'],
  },
  {
    keywords: ['英語', '語学', '学習'],
    suggestions: ['単語', 'リスニング', 'スピーキング', '進捗記録'],
  },
  {
    keywords: ['健康', '運動', '筋トレ'],
    suggestions: ['習慣化', 'メニュー設計', '記録', '休養'],
  },
  {
    keywords: ['仕事', 'キャリア', '転職'],
    suggestions: ['職務経歴', '面接準備', '学習テーマ', '人脈づくり'],
  },
  {
    keywords: ['創作', '作品', '発信'],
    suggestions: ['制作フロー', '公開', 'フィードバック', '次回作'],
  },
]

type HistoryAction<T> =
  | { type: 'commit'; next: T }
  | { type: 'replace'; next: T }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; next: T }

function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>) {
  switch (action.type) {
    case 'commit': {
      const past = [...state.past, state.present].slice(-MAX_HISTORY)
      return {
        past,
        present: action.next,
        future: [],
      }
    }
    case 'replace':
      return {
        ...state,
        present: action.next,
      }
    case 'reset':
      return {
        past: [],
        present: action.next,
        future: [],
      }
    case 'undo': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }
    case 'redo': {
      if (state.future.length === 0) return state
      const [next, ...rest] = state.future
      return {
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        present: next,
        future: rest,
      }
    }
  }
}

function useHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(historyReducer<T>, {
    past: [],
    present: initial,
    future: [],
  })

  const commit = useCallback((next: T) => dispatch({ type: 'commit', next }), [])
  const replace = useCallback((next: T) => dispatch({ type: 'replace', next }), [])
  const reset = useCallback((next: T) => dispatch({ type: 'reset', next }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  return {
    state,
    commit,
    replace,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}

function useToast() {
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const showToast = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone })
  }, [])

  return { toast, showToast }
}

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function buildChildrenMap(nodes: NodeItem[]) {
  const map = new Map<string, NodeItem[]>()
  for (const node of nodes) {
    const list = map.get(node.p) ?? []
    list.push(node)
    map.set(node.p, list)
  }
  return map
}

function getNextId(nodes: NodeItem[]) {
  let max = 0
  for (const node of nodes) {
    const value = Number.parseInt(node.i, 36)
    if (!Number.isNaN(value)) {
      max = Math.max(max, value)
    }
  }
  return (max + 1).toString(36)
}

function encodeData(data: TreeData) {
  try {
    const json = JSON.stringify(data)
    return compressToEncodedURIComponent(json)
  } catch {
    return ''
  }
}

function isValidData(data: unknown): data is TreeData {
  if (!data || typeof data !== 'object') return false
  const value = data as TreeData
  if (!value.nodes || !Array.isArray(value.nodes)) return false
  if (!value.meta || typeof value.meta !== 'object') return false
  return value.nodes.every((node) => {
    if (!node || typeof node !== 'object') return false
    if (typeof node.i !== 'string' || typeof node.p !== 'string') return false
    if (typeof node.t !== 'string') return false
    if (![0, 1, 2, 3].includes(node.s)) return false
    if (node.d && typeof node.d !== 'string') return false
    if (node.g && !Array.isArray(node.g)) return false
    return true
  })
}

function decodeData(encoded: string) {
  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const parsed = JSON.parse(json)
    if (!isValidData(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

function buildUrl(base: string, data: TreeData, view: ViewMode, jsonMode: boolean, share: boolean) {
  const params = new URLSearchParams()
  params.set('v', String(SCHEMA_VERSION))
  params.set('d', encodeData(data))
  if (view !== 'map') params.set('view', view)
  if (jsonMode) params.set('type', 'json')
  if (share) params.set('share', '1')
  return `${base}?${params.toString()}`
}

function computePathIds(nodes: NodeItem[], selectedId: string | null) {
  const path = new Set<string>()
  if (!selectedId) return path
  const parentMap = new Map(nodes.map((node) => [node.i, node.p]))
  let current = selectedId
  while (current) {
    path.add(current)
    const parent = parentMap.get(current)
    if (!parent) break
    current = parent
  }
  return path
}

function expandPath(data: TreeData, targetId: string) {
  const parentMap = new Map(data.nodes.map((node) => [node.i, node.p]))
  const updated = data.nodes.map((node) => ({ ...node }))
  const updatedMap = new Map(updated.map((node) => [node.i, node]))
  let current = parentMap.get(targetId)
  let changed = false
  while (current) {
    const item = updatedMap.get(current)
    if (item && item.c === 1) {
      item.c = 0
      changed = true
    }
    current = parentMap.get(current)
  }
  return changed ? { ...data, nodes: updated } : data
}

function buildLayout(data: TreeData): LayoutResult {
  const childrenMap = buildChildrenMap(data.nodes)

  const buildNested = (node: NodeItem): NestedLayoutNode => {
    const children = childrenMap.get(node.i) ?? []
    if (node.c === 1) {
      return { ...node }
    }
    return {
      ...node,
      children: children.map(buildNested),
    }
  }

  const roots = childrenMap.get('') ?? []
  const virtualRoot: NestedLayoutNode = {
    i: '__root__',
    p: '',
    t: 'root',
    s: 0 as Status,
    children: roots.map(buildNested),
  }

  const root = tree<NestedLayoutNode>().nodeSize([96, 256])(
    hierarchy(virtualRoot, (node) => node.children)
  )

  const nodes: LayoutNode[] = []
  const positions = new Map<string, { x: number; y: number }>()

  for (const node of root.descendants()) {
    if (node.data.i === '__root__') continue
    const position = { x: node.y, y: node.x }
    nodes.push({
      id: node.data.i,
      data: node.data,
      x: position.x,
      y: position.y,
      depth: node.depth,
      parentId: node.parent?.data?.i,
    })
    positions.set(node.data.i, position)
  }

  const links = root
    .links()
    .filter((link) => link.source.data.i !== '__root__')
    .map((link) => {
      const source = nodes.find((item) => item.id === link.source.data.i)
      const target = nodes.find((item) => item.id === link.target.data.i)
      if (!source || !target) return null
      return { source, target }
    })
    .filter(Boolean) as { source: LayoutNode; target: LayoutNode }[]

  return { nodes, links, positions }
}

function removeDescendants(nodes: NodeItem[], targetId: string) {
  const childrenMap = buildChildrenMap(nodes)
  const toDelete = new Set<string>()
  const visit = (id: string) => {
    toDelete.add(id)
    const children = childrenMap.get(id) ?? []
    for (const child of children) {
      visit(child.i)
    }
  }
  visit(targetId)
  return nodes.filter((node) => !toDelete.has(node.i))
}

function renumberIds(data: TreeData) {
  const childrenMap = buildChildrenMap(data.nodes)
  const ordered: NodeItem[] = []

  const visit = (node: NodeItem) => {
    ordered.push(node)
    const children = childrenMap.get(node.i) ?? []
    for (const child of children) {
      visit(child)
    }
  }

  const roots = childrenMap.get('') ?? []
  for (const root of roots) {
    visit(root)
  }

  const idMap = new Map<string, string>()
  ordered.forEach((node, index) => idMap.set(node.i, index.toString(36)))

  const nodes = data.nodes.map((node) => ({
    ...node,
    i: idMap.get(node.i) ?? node.i,
    p: node.p ? (idMap.get(node.p) ?? '') : '',
  }))

  return { ...data, nodes }
}

function normalizeTags(data: TreeData) {
  const nodes = data.nodes.map((node) => {
    if (!node.g) return node
    const cleaned = node.g
      .map((tag) => tag.trim().replace(/\s+/g, ' '))
      .filter((tag) => tag.length > 0)
    const unique = Array.from(new Set(cleaned))
    return unique.length > 0 ? { ...node, g: unique } : { ...node, g: undefined }
  })
  return { ...data, nodes }
}

function shortenTitles(data: TreeData) {
  const maxLength = 16
  const nodes = data.nodes.map((node) => {
    if (node.t.length <= maxLength) return node
    const short = `${node.t.slice(0, maxLength - 3)}...`
    return { ...node, t: short }
  })
  return { ...data, nodes }
}

function getDiscoveryCards(data: TreeData) {
  const childrenMap = buildChildrenMap(data.nodes)
  const parentMap = new Map(data.nodes.map((node) => [node.i, node.p]))
  const statusMap = new Map(data.nodes.map((node) => [node.i, node.s]))

  return data.nodes
    .map((node) => {
      const children = childrenMap.get(node.i) ?? []
      const parentId = parentMap.get(node.i)
      const parentStatus = parentId ? statusMap.get(parentId) : undefined
      let score = 0
      let reason = ''

      if (node.s === 1 && children.length >= 2) {
        score += 60 + children.length * 4
        reason = '進行中で枝が多い。伸びしろが大きい'
      }

      if (node.s === 2 && parentStatus !== 2 && parentStatus !== undefined) {
        score += 55
        reason = '完了済みだが上位が未完了。波及効果を確認'
      }

      if (node.s === 0 && parentStatus === 2) {
        score += 50
        reason = '上位が完了済み。今着手すると流れが良い'
      }

      if (node.s === 3) {
        score += 30
        reason = '保留中のため再起動に良いタイミング'
      }

      if (!reason) {
        score += 10 + children.length * 2
        reason = '次の一歩を確認しよう'
      }

      return { node, score, reason }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

function getAdjacentSuggestions(node: NodeItem | null) {
  if (!node) return ['次の一歩', '小さな習慣', '見直し']
  for (const template of ADJACENT_TEMPLATES) {
    if (template.keywords.some((keyword) => node.t.includes(keyword))) {
      return template.suggestions
    }
  }
  return ['準備', '計画', '実行', '振り返り']
}

function buildShareText(title: string | undefined, rate: number) {
  const safeTitle = title?.trim() || 'Achievement Tree'
  return `${safeTitle} | 達成率 ${Math.round(rate * 100)}%`
}

interface MapViewProps {
  data: TreeData
  selectedId: string | null
  selectedNode: NodeItem | null
  focusId: string | null
  onFocusHandled: () => void
  onSelect: (id: string) => void
  onAddChild: (parentId: string, title?: string) => void
  onAddRoot: () => void
  onToggleCollapse: (id: string) => void
  onUpdateNode: (id: string, changes: Partial<NodeItem>) => void
  onDelete: (id: string) => void
  onEditingChange: (editing: boolean) => void
}

function MapView({
  data,
  selectedId,
  selectedNode,
  focusId,
  onFocusHandled,
  onSelect,
  onAddChild,
  onAddRoot,
  onToggleCollapse,
  onUpdateNode,
  onDelete,
  onEditingChange,
}: MapViewProps) {
  const layout = useMemo(() => buildLayout(data), [data])
  const pathIds = useMemo(() => computePathIds(data.nodes, selectedId), [data.nodes, selectedId])
  const childrenMap = useMemo(() => buildChildrenMap(data.nodes), [data.nodes])

  const stageRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const isDraggingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const velocityRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0, k: 1 })
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 })
  const [dockSize, setDockSize] = useState({ width: 0, height: 0 })
  const [tagDraft, setTagDraft] = useState('')
  const [flashId, setFlashId] = useState<string | null>(null)

  const nodeWidth = 192
  const nodeHeight = 64

  useLayoutEffect(() => {
    if (!stageRef.current) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        setStageSize({ width: rect.width, height: rect.height })
      }
    })
    observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (!dockRef.current) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) {
        setDockSize({ width: rect.width, height: rect.height })
      }
    })
    observer.observe(dockRef.current)
    return () => observer.disconnect()
  }, [])

  const animate = useCallback(() => {
    rafRef.current = null
    const current = transformRef.current
    if (!isDraggingRef.current) {
      const velocity = velocityRef.current
      if (Math.abs(velocity.x) > 0.05 || Math.abs(velocity.y) > 0.05) {
        targetRef.current = {
          ...targetRef.current,
          x: targetRef.current.x + velocity.x,
          y: targetRef.current.y + velocity.y,
        }
        velocityRef.current = {
          x: velocity.x * 0.9,
          y: velocity.y * 0.9,
        }
      }
    }
    const next = {
      x: current.x + (targetRef.current.x - current.x) * 0.22,
      y: current.y + (targetRef.current.y - current.y) * 0.22,
      k: current.k + (targetRef.current.k - current.k) * 0.18,
    }
    transformRef.current = next
    setTransform(next)
    const velocity = velocityRef.current
    const needsFrame =
      Math.abs(targetRef.current.x - next.x) > 0.1 ||
      Math.abs(targetRef.current.y - next.y) > 0.1 ||
      Math.abs(targetRef.current.k - next.k) > 0.001 ||
      Math.abs(velocity.x) > 0.1 ||
      Math.abs(velocity.y) > 0.1
    if (needsFrame) {
      rafRef.current = requestAnimationFrame(animate)
    }
  }, [])

  const scheduleFrame = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(animate)
  }, [animate])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const base = targetRef.current
      const nextK = clamp(base.k * Math.exp(-event.deltaY * 0.0014), 0.25, 2.8)
      const scale = nextK / base.k
      const nextX = pointerX - scale * (pointerX - base.x)
      const nextY = pointerY - scale * (pointerY - base.y)
      targetRef.current = { x: nextX, y: nextY, k: nextK }
      scheduleFrame()
    }
    svg.addEventListener('wheel', handleWheel, { passive: false })
    return () => svg.removeEventListener('wheel', handleWheel)
  }, [scheduleFrame])

  useEffect(() => {
    if (!focusId) return
    const position = layout.positions.get(focusId)
    if (!position || !stageSize.width || !stageSize.height) return
    const scale = targetRef.current.k || 1
    const nextX = stageSize.width / 2 - (position.x + nodeWidth / 2) * scale
    const nextY = stageSize.height / 2 - (position.y + nodeHeight / 2) * scale
    targetRef.current = { ...targetRef.current, x: nextX, y: nextY }
    velocityRef.current = { x: 0, y: 0 }
    scheduleFrame()
    onFocusHandled()
  }, [focusId, layout.positions, onFocusHandled, scheduleFrame, stageSize])

  useEffect(() => {
    if (!editingId) return
    onEditingChange(true)
    return () => onEditingChange(false)
  }, [editingId, onEditingChange])

  useEffect(() => {
    setTagDraft('')
  }, [])

  useEffect(() => {
    if (!flashId) return
    const timeout = window.setTimeout(() => setFlashId(null), 420)
    return () => window.clearTimeout(timeout)
  }, [flashId])

  const handleStartEdit = (node: NodeItem) => {
    setEditingId(node.i)
    setEditingValue(node.t)
  }

  const handleCommitEdit = () => {
    if (!editingId) return
    const title = editingValue.trim() || 'Untitled'
    onUpdateNode(editingId, { t: title })
    setEditingId(null)
    setEditingValue('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingValue('')
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleCommitEdit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelEdit()
    }
  }

  const handleStatusChange = (status: Status) => {
    if (!selectedNode) return
    const changes: Partial<NodeItem> = { s: status }
    if (status === 2 && !selectedNode.d) {
      changes.d = getToday()
    }
    if (status !== 2) {
      changes.d = undefined
    }
    onUpdateNode(selectedNode.i, changes)
    setFlashId(selectedNode.i)
  }

  const handleTagCommit = () => {
    if (!selectedNode) return
    const raw = tagDraft.trim()
    if (!raw) return
    const incoming = raw
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
    if (incoming.length === 0) return
    const next = Array.from(new Set([...(selectedNode.g ?? []), ...incoming]))
    onUpdateNode(selectedNode.i, { g: next.length ? next : undefined })
    setTagDraft('')
  }

  const handleTagRemove = (tag: string) => {
    if (!selectedNode?.g) return
    const next = selectedNode.g.filter((item) => item !== tag)
    onUpdateNode(selectedNode.i, { g: next.length ? next : undefined })
  }

  const handleTagKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleTagCommit()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setTagDraft('')
    }
  }

  const handleCenterOnSelected = () => {
    if (!selectedNode) return
    const position = layout.positions.get(selectedNode.i)
    if (!position || !stageSize.width || !stageSize.height) return
    const scale = targetRef.current.k || 1
    const nextX = stageSize.width / 2 - (position.x + nodeWidth / 2) * scale
    const nextY = stageSize.height / 2 - (position.y + nodeHeight / 2) * scale
    targetRef.current = { ...targetRef.current, x: nextX, y: nextY }
    velocityRef.current = { x: 0, y: 0 }
    scheduleFrame()
  }

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const target = event.target as Element
    if (target.closest('[data-node="true"]')) return
    isDraggingRef.current = true
    setIsDragging(true)
    lastPointRef.current = { x: event.clientX, y: event.clientY, time: performance.now() }
    velocityRef.current = { x: 0, y: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current || !lastPointRef.current) return
    const dx = event.clientX - lastPointRef.current.x
    const dy = event.clientY - lastPointRef.current.y
    lastPointRef.current = { x: event.clientX, y: event.clientY, time: performance.now() }
    targetRef.current = {
      ...targetRef.current,
      x: targetRef.current.x + dx,
      y: targetRef.current.y + dy,
    }
    velocityRef.current = { x: dx, y: dy }
    scheduleFrame()
  }

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    lastPointRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const dockStyle = useMemo(() => {
    if (!selectedNode) return null
    const position = layout.positions.get(selectedNode.i)
    if (!position) return null
    const scale = transform.k || 1
    const anchorX = position.x * scale + transform.x
    const anchorY = position.y * scale + transform.y
    const rawLeft = anchorX + nodeWidth * scale + 16
    const rawTop = anchorY - 16
    const maxLeft = Math.max(16, stageSize.width - dockSize.width - 16)
    const maxTop = Math.max(16, stageSize.height - dockSize.height - 16)
    return {
      left: clamp(rawLeft, 16, maxLeft),
      top: clamp(rawTop, 16, maxTop),
    }
  }, [
    dockSize.height,
    dockSize.width,
    layout.positions,
    selectedNode,
    stageSize.height,
    stageSize.width,
    transform.k,
    transform.x,
    transform.y,
  ])

  useEffect(() => {
    if (stageSize.width === 0 || stageSize.height === 0) return
    if (layout.nodes.length === 0) return
    if (
      transformRef.current.k !== 1 ||
      transformRef.current.x !== 0 ||
      transformRef.current.y !== 0
    ) {
      return
    }
    const bounds = layout.nodes.reduce(
      (acc, node) => {
        acc.minX = Math.min(acc.minX, node.x)
        acc.maxX = Math.max(acc.maxX, node.x)
        acc.minY = Math.min(acc.minY, node.y)
        acc.maxY = Math.max(acc.maxY, node.y)
        return acc
      },
      {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      }
    )
    const centerX = (bounds.minX + bounds.maxX) / 2 + nodeWidth / 2
    const centerY = (bounds.minY + bounds.maxY) / 2 + nodeHeight / 2
    const nextX = stageSize.width / 2 - centerX
    const nextY = stageSize.height / 2 - centerY
    targetRef.current = { ...targetRef.current, x: nextX, y: nextY, k: 1 }
    scheduleFrame()
  }, [layout.nodes, scheduleFrame, stageSize.height, stageSize.width])

  const selectedChildren = selectedNode ? (childrenMap.get(selectedNode.i) ?? []) : []
  const selectedHasChildren = selectedChildren.length > 0

  return (
    <div className={`map-stage${isDragging ? ' dragging' : ''}`} ref={stageRef}>
      <svg
        ref={svgRef}
        className="map-svg"
        aria-label="Achievement Tree Map"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <rect
          x={0}
          y={0}
          width="100%"
          height="100%"
          fill="transparent"
          onDoubleClick={(event) => {
            event.stopPropagation()
            onAddRoot()
          }}
        />
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {layout.links.map((link) => {
            const isPath = pathIds.has(link.target.id) && pathIds.has(link.source.id)
            return (
              <path
                key={`${link.source.id}-${link.target.id}`}
                className={`link-line${isPath ? ' path' : ''}`}
                d={
                  `M${link.source.x + nodeWidth} ${link.source.y + nodeHeight / 2} ` +
                  `C${link.source.x + nodeWidth + 64} ${link.source.y + nodeHeight / 2} ` +
                  `${link.target.x - 64} ${link.target.y + nodeHeight / 2} ` +
                  `${link.target.x} ${link.target.y + nodeHeight / 2}`
                }
              />
            )
          })}
          {layout.nodes.map((node) => {
            const isSelected = node.id === selectedId
            const isPath = pathIds.has(node.id)
            return (
              <g
                key={node.id}
                data-node="true"
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(node.id)
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  handleStartEdit(node.data)
                }}
              >
                <rect
                  className={`node-rect${isSelected ? ' selected' : ''}${isPath ? ' path' : ''}${
                    node.id === flashId ? ' flash' : ''
                  }`}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={16}
                  ry={16}
                />
                <circle
                  className={`node-pill ${STATUS_LABELS[node.data.s]}`}
                  cx={24}
                  cy={24}
                  r={8}
                />
                <text className="node-title" x={40} y={32}>
                  {node.data.t}
                </text>
                <text className="node-status" x={40} y={48}>
                  {STATUS_NAMES[node.data.s]}
                </text>

                <g
                  onClick={(event) => {
                    event.stopPropagation()
                    onAddChild(node.id)
                  }}
                >
                  <circle className="node-action" cx={nodeWidth - 24} cy={24} r={24} />
                  <text
                    className="node-action-text"
                    x={nodeWidth - 24}
                    y={24}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    +
                  </text>
                </g>

                {editingId === node.id ? (
                  <foreignObject width={nodeWidth} height={nodeHeight} x={0} y={0}>
                    <input
                      className="node-input"
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onBlur={handleCommitEdit}
                      onKeyDown={handleKeyDown}
                    />
                  </foreignObject>
                ) : null}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="map-hint">Drag to pan · Wheel to zoom · Double-click to add</div>
      <button className="sig-btn accent root-add" onClick={onAddRoot}>
        <Plus size={16} />
        Add root
      </button>

      {selectedNode && dockStyle ? (
        <div className="node-dock" ref={dockRef} style={dockStyle}>
          <div>
            <div className="dock-title">{selectedNode.t}</div>
            <div className="dock-meta">
              {STATUS_NAMES[selectedNode.s]}
              {selectedNode.d ? ` · ${selectedNode.d}` : ''}
            </div>
          </div>
          <div className="status-row">
            {([0, 1, 2, 3] as Status[]).map((status) => (
              <button
                key={status}
                className={`status-chip${selectedNode.s === status ? ' active' : ''}`}
                onClick={() => handleStatusChange(status)}
              >
                {STATUS_NAMES[status]}
              </button>
            ))}
          </div>
          <div className="dock-actions">
            <button className="sig-btn ghost" onClick={() => onAddChild(selectedNode.i)}>
              <Plus size={14} />
              Add child
            </button>
            <button className="sig-btn ghost" onClick={handleCenterOnSelected}>
              Center
            </button>
            {selectedHasChildren ? (
              <button className="sig-btn ghost" onClick={() => onToggleCollapse(selectedNode.i)}>
                {selectedNode.c === 1 ? 'Expand' : 'Collapse'}
              </button>
            ) : null}
            <button className="sig-btn warn" onClick={() => onDelete(selectedNode.i)}>
              <Trash2 size={14} />
              Delete
            </button>
          </div>
          <div>
            <div className="dock-meta">Tags</div>
            <div className="tag-list">
              {(selectedNode.g ?? []).map((tag) => (
                <div key={tag} className="tag-chip">
                  {tag}
                  <button onClick={() => handleTagRemove(tag)}>x</button>
                </div>
              ))}
            </div>
            <input
              className="tag-input"
              value={tagDraft}
              placeholder="Add tag, Enter"
              onChange={(event) => setTagDraft(event.target.value)}
              onBlur={handleTagCommit}
              onKeyDown={handleTagKeyDown}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface ExploreViewProps {
  data: TreeData
  selected: NodeItem | null
  onFocus: (id: string) => void
  onAddChild: (parentId: string, title: string) => void
}

function ExploreView({ data, selected, onFocus, onAddChild }: ExploreViewProps) {
  const cards = useMemo(() => getDiscoveryCards(data), [data])
  const suggestions = useMemo(() => getAdjacentSuggestions(selected), [selected])

  return (
    <div className="explore-grid">
      <section className="surface" style={{ padding: 16, display: 'grid', gap: 16 }}>
        <div className="section-title">Discovery Cards</div>
        <div className="discovery-row">
          {cards.map((card) => (
            <div className="discovery-card" key={card.node.i}>
              <strong>{card.node.t}</strong>
              <div style={{ fontSize: 12, color: '#3f4654' }}>{card.reason}</div>
              <button onClick={() => onFocus(card.node.i)}>Mapで確認</button>
            </div>
          ))}
        </div>
      </section>
      <section className="suggestion-board">
        <div className="section-title">Adjacent Possible</div>
        <p style={{ fontSize: 12, color: '#3f4654' }}>
          {selected ? `${selected.t} の次に生えやすい候補` : 'ノードを選択してください'}
        </p>
        <div className="chip-row">
          {suggestions.slice(0, 4).map((text) => (
            <button
              key={text}
              onClick={() => {
                if (selected) onAddChild(selected.i, text)
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

interface TimelineViewProps {
  data: TreeData
  onFocus: (id: string) => void
}

function TimelineView({ data, onFocus }: TimelineViewProps) {
  const doneItems = useMemo(() => {
    return data.nodes
      .filter((node) => node.s === 2 && node.d)
      .sort((a, b) => (a.d! < b.d! ? 1 : -1))
  }, [data.nodes])

  const doneRate = data.nodes.length ? doneItems.length / data.nodes.length : 0

  return (
    <div>
      <div className="metric-grid" style={{ marginBottom: 16 }}>
        <div className="metric">
          <p>達成率</p>
          <strong>{Math.round(doneRate * 100)}%</strong>
        </div>
        <div className="metric">
          <p>直近達成トップ3</p>
          <strong>{doneItems.slice(0, 3).length}</strong>
        </div>
      </div>
      <div className="timeline">
        {doneItems.length === 0 ? (
          <div className="discovery-card">
            <strong>まだ達成がありません</strong>
            <p style={{ margin: 0, color: '#3f4654', fontSize: 12 }}>
              Doneに変更するとタイムラインに表示されます。
            </p>
          </div>
        ) : null}
        {doneItems.map((item) => (
          <div className="timeline-item" key={item.i}>
            <div>
              <strong>{item.t}</strong>
              <div style={{ fontSize: 12, color: '#3f4654' }}>{item.d}</div>
            </div>
            <button onClick={() => onFocus(item.i)}>Mapへ</button>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ShareCardProps {
  data: TreeData
  url: string
  onShare: () => void
  onCopy: () => void
  onOpenX: () => void
  onExit: () => void
}

function ShareCard({ data, url, onShare, onCopy, onOpenX, onExit }: ShareCardProps) {
  const doneItems = data.nodes
    .filter((node) => node.s === 2 && node.d)
    .sort((a, b) => (a.d! < b.d! ? 1 : -1))
  const doneRate = data.nodes.length ? doneItems.length / data.nodes.length : 0

  return (
    <div className="share-card">
      <h2>{data.meta.title || 'Achievement Tree'}</h2>
      <div className="metric-grid">
        <div className="metric">
          <p>ノード数</p>
          <strong>{data.nodes.length}</strong>
        </div>
        <div className="metric">
          <p>達成率</p>
          <strong>{Math.round(doneRate * 100)}%</strong>
        </div>
        <div className="metric">
          <p>直近達成</p>
          <strong>{doneItems.slice(0, 3).length}</strong>
        </div>
      </div>
      <div>
        <h4 style={{ margin: '16px 0 8px 0' }}>Recent Done</h4>
        <div className="timeline">
          {doneItems.slice(0, 3).map((item) => (
            <div className="timeline-item" key={item.i}>
              <div>
                <strong>{item.t}</strong>
                <div style={{ fontSize: 12, color: '#3f4654' }}>{item.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="share-actions">
        <button className="sig-btn" onClick={onShare}>
          <Share2 size={16} />
          Share
        </button>
        <button className="sig-btn ghost" onClick={onCopy}>
          <Copy size={16} />
          Copy URL
        </button>
        <button className="sig-btn ghost" onClick={onOpenX}>
          <LinkIcon size={16} />
          Post to X
        </button>
        <button className="sig-btn ghost" onClick={onExit}>
          Back
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#3f4654', wordBreak: 'break-all' }}>{url}</div>
    </div>
  )
}

interface JsonViewProps {
  json: string
  onCopy: () => void
  onExit: () => void
}

function JsonView({ json, onCopy, onExit }: JsonViewProps) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="json-view">{json}</div>
      <div className="share-actions">
        <button className="sig-btn" onClick={onCopy}>
          <Copy size={16} />
          JSONコピー
        </button>
        <button className="sig-btn ghost" onClick={onExit}>
          Back
        </button>
      </div>
    </div>
  )
}

export function AchievementTreeApp() {
  const baseUrlRef = useRef('')
  const [view, setView] = useState<ViewMode>('map')
  const [jsonMode, setJsonMode] = useState(false)
  const [shareMode, setShareMode] = useState(false)
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [urlLength, setUrlLength] = useState(0)
  const handleAddChildRef = useRef<(parentId: string, title?: string) => void>(() => {})

  const { toast, showToast } = useToast()
  const {
    state: historyState,
    commit,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<TreeData>(DEFAULT_DATA)
  const data = historyState.present

  const selectedNode = useMemo(
    () => data.nodes.find((node) => node.i === selectedId) ?? null,
    [data.nodes, selectedId]
  )

  useEffect(() => {
    baseUrlRef.current = `${window.location.origin}${window.location.pathname}`
    const params = new URLSearchParams(window.location.search)
    const version = params.get('v')
    const encoded = params.get('d')
    const viewParam = params.get('view')
    const typeParam = params.get('type')
    const shareParam = params.get('share')

    if (viewParam === 'map' || viewParam === 'explore' || viewParam === 'timeline') {
      setView(viewParam)
    }
    setJsonMode(typeParam === 'json')
    setShareMode(shareParam === '1')

    if (version && version !== String(SCHEMA_VERSION)) {
      setDecodeError('Unsupported version')
      reset(DEFAULT_DATA)
      return
    }

    if (encoded) {
      const decoded = decodeData(encoded)
      if (decoded) {
        reset(decoded)
      } else {
        setDecodeError('URL data is corrupted')
        reset(DEFAULT_DATA)
      }
    } else {
      reset(DEFAULT_DATA)
    }
  }, [reset])

  useEffect(() => {
    if (!baseUrlRef.current || decodeError) return
    const url = buildUrl(baseUrlRef.current, data, view, jsonMode, shareMode)
    window.history.replaceState(null, '', url)
    setUrlLength(url.length)
  }, [data, view, jsonMode, shareMode, decodeError])

  const handleUpdateData = useCallback(
    (updater: (prev: TreeData) => TreeData) => {
      commit(updater(historyState.present))
    },
    [commit, historyState.present]
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, changes: Partial<NodeItem>) => {
      handleUpdateData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) => (node.i === nodeId ? { ...node, ...changes } : node)),
      }))
    },
    [handleUpdateData]
  )

  const handleAddChild = useCallback(
    (parentId: string, title = 'New Node') => {
      const nextId = getNextId(data.nodes)
      commit({
        ...data,
        nodes: [...data.nodes, { i: nextId, p: parentId, t: title, s: 0 }],
      })
      setSelectedId(nextId)
      setFocusId(nextId)
    },
    [commit, data]
  )

  useEffect(() => {
    handleAddChildRef.current = handleAddChild
  }, [handleAddChild])

  const handleAddRoot = useCallback(() => {
    const nextId = getNextId(data.nodes)
    commit({
      ...data,
      nodes: [...data.nodes, { i: nextId, p: '', t: 'New Root', s: 0 }],
    })
    setSelectedId(nextId)
    setFocusId(nextId)
  }, [commit, data])

  const handleDelete = useCallback(
    (nodeId: string) => {
      handleUpdateData((prev) => ({
        ...prev,
        nodes: removeDescendants(prev.nodes, nodeId),
      }))
      if (selectedId === nodeId) setSelectedId(null)
      showToast('削除しました。Undoで戻せます')
    },
    [handleUpdateData, selectedId, showToast]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isEditing) return
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selectedId) return
        event.preventDefault()
        handleDelete(selectedId)
      }

      if (event.key === 'Tab' && selectedId) {
        event.preventDefault()
        handleAddChildRef.current(selectedId)
      }

      if (event.key === 'Escape') {
        setSelectedId(null)
      }
    },
    [handleDelete, isEditing, redo, selectedId, undo]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleShare = useCallback(async () => {
    const url = buildUrl(baseUrlRef.current, data, view, jsonMode, true)
    const text = buildShareText(data.meta.title, getDoneRate(data))

    try {
      if (navigator.share) {
        await navigator.share({
          title: data.meta.title || 'Achievement Tree',
          text,
          url,
        })
        showToast('Share完了')
        return
      }
      await navigator.clipboard.writeText(url)
      showToast('URLをコピーしました')
    } catch (error) {
      console.error(error)
      showToast('共有に失敗しました', 'error')
    }
  }, [data, jsonMode, showToast, view])

  const handleCopyUrl = useCallback(async () => {
    const url = buildUrl(baseUrlRef.current, data, view, jsonMode, true)
    try {
      await navigator.clipboard.writeText(url)
      showToast('URLをコピーしました')
    } catch {
      showToast('コピーできませんでした', 'error')
    }
  }, [data, jsonMode, showToast, view])

  const handleCopyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      showToast('JSONをコピーしました')
    } catch {
      showToast('コピーできませんでした', 'error')
    }
  }, [data, showToast])

  const handleOpenX = useCallback(() => {
    const url = buildUrl(baseUrlRef.current, data, view, jsonMode, true)
    const text = buildShareText(data.meta.title, getDoneRate(data))
    const query = new URLSearchParams({ text, url })
    window.open(
      `https://twitter.com/intent/tweet?${query.toString()}`,
      '_blank',
      'noopener,noreferrer'
    )
  }, [data, jsonMode, view])

  const handleNew = useCallback(() => {
    setDecodeError(null)
    commit(DEFAULT_DATA)
    setSelectedId(null)
    setFocusId(null)
    setView('map')
    setJsonMode(false)
    setShareMode(false)
    showToast('新しいツリーを開始しました')
  }, [commit, showToast])

  const handleFocus = useCallback(
    (id: string) => {
      setView('map')
      setSelectedId(id)
      const expanded = expandPath(historyState.present, id)
      if (expanded !== historyState.present) {
        commit(expanded)
      }
      setFocusId(id)
    },
    [commit, historyState.present]
  )

  const handleFocusHandled = useCallback(() => {
    setFocusId(null)
  }, [])

  const handleExitJson = useCallback(() => {
    setJsonMode(false)
  }, [])

  const handleExitShare = useCallback(() => {
    setShareMode(false)
  }, [])

  const shrinkOptions = useMemo(() => {
    const hasLongTitles = data.nodes.some((node) => node.t.length > 16)
    const hasTags = data.nodes.some((node) => node.g && node.g.length > 0)
    return [
      {
        id: 'shorten',
        title: '長いタイトルを省略',
        description: '16文字超のタイトルを短くします',
        enabled: hasLongTitles,
        apply: () => commit(shortenTitles(data)),
      },
      {
        id: 'tags',
        title: 'タグを正規化',
        description: '空白削除と重複排除で軽量化',
        enabled: hasTags,
        apply: () => commit(normalizeTags(data)),
      },
      {
        id: 'ids',
        title: 'IDを詰め直す',
        description: 'a,b,c...に再番号化して圧縮',
        enabled: data.nodes.length > 0,
        apply: () => commit(renumberIds(data)),
      },
    ]
  }, [commit, data])

  const showShrink = urlLength > HARD_LIMIT
  const warning = urlLength > HARD_LIMIT * 0.8
  const statusLabel =
    urlLength <= SOFT_LIMIT
      ? 'Comfort'
      : urlLength <= HARD_LIMIT
        ? 'Tight'
        : urlLength <= DANGER_LIMIT
          ? 'Risk'
          : 'Danger'
  const gaugeRatio = clamp(urlLength / HARD_LIMIT, 0, 1.25)
  const gaugeAngle = -110 + gaugeRatio * 220

  const jsonText = useMemo(() => JSON.stringify(data, null, 2), [data])
  const baseUrl =
    baseUrlRef.current ||
    (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '')
  const shareUrl = buildUrl(baseUrl, data, view, jsonMode, true)

  if (decodeError) {
    return (
      <div className="app-root">
        <style>{STYLE_TEXT}</style>
        <div className="surface" style={{ padding: 16, maxWidth: 360, display: 'grid', gap: 16 }}>
          <h3>Decode Error</h3>
          <p style={{ fontSize: 12, color: '#3f4654' }}>
            URLが壊れている可能性があります。Newで初期化できます。
          </p>
          <button className="sig-btn" onClick={handleNew}>
            <RefreshCw size={16} />
            New
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-root">
      <style>{STYLE_TEXT}</style>

      <header className="command-bar surface">
        <div className="brand">
          <input
            className="title-input"
            value={data.meta.title ?? ''}
            placeholder="Title"
            onChange={(event) =>
              commit({
                ...data,
                meta: { ...data.meta, title: event.target.value },
              })
            }
          />
          <div className="meta-pill">{data.nodes.length} Nodes</div>
        </div>

        <div className="view-switch" role="tablist" aria-label="View mode">
          <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
            <LayoutGrid size={16} /> Map
          </button>
          <button className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')}>
            <ChevronRight size={16} /> Explore
          </button>
          <button
            className={view === 'timeline' ? 'active' : ''}
            onClick={() => setView('timeline')}
          >
            <ListChecks size={16} /> Timeline
          </button>
        </div>

        <div className="action-cluster">
          <button
            className="sig-btn ghost icon"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="sig-btn ghost icon"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
          {jsonMode || shareMode ? (
            <button
              className="sig-btn ghost"
              onClick={() => {
                setJsonMode(false)
                setShareMode(false)
              }}
            >
              Back
            </button>
          ) : (
            <>
              <button className="sig-btn ghost" onClick={handleShare}>
                <Share2 size={16} />
                Share
              </button>
              <button className="sig-btn ghost icon" onClick={handleCopyUrl} aria-label="Copy URL">
                <Copy size={16} />
              </button>
              <button className="sig-btn ghost icon" onClick={handleOpenX} aria-label="Post to X">
                <LinkIcon size={16} />
              </button>
              <button className="sig-btn ghost" onClick={() => setShareMode(true)}>
                Card
              </button>
              <button className="sig-btn ghost" onClick={() => setJsonMode(true)}>
                JSON
              </button>
            </>
          )}
          <button className="sig-btn" onClick={handleNew}>
            <RefreshCw size={16} />
            New
          </button>
        </div>
      </header>

      <div className={`main${view === 'map' ? '' : ' full'}`}>
        {jsonMode ? (
          <JsonView json={jsonText} onCopy={handleCopyJson} onExit={handleExitJson} />
        ) : shareMode ? (
          <ShareCard
            data={data}
            url={shareUrl}
            onShare={handleShare}
            onCopy={handleCopyUrl}
            onOpenX={handleOpenX}
            onExit={handleExitShare}
          />
        ) : view === 'map' ? (
          <MapView
            data={data}
            selectedId={selectedId}
            selectedNode={selectedNode}
            focusId={focusId}
            onFocusHandled={handleFocusHandled}
            onSelect={setSelectedId}
            onAddChild={handleAddChild}
            onAddRoot={handleAddRoot}
            onToggleCollapse={(id) =>
              handleUpdateNode(id, { c: data.nodes.find((node) => node.i === id)?.c ? 0 : 1 })
            }
            onUpdateNode={handleUpdateNode}
            onDelete={handleDelete}
            onEditingChange={setIsEditing}
          />
        ) : view === 'explore' ? (
          <ExploreView
            data={data}
            selected={selectedNode}
            onFocus={handleFocus}
            onAddChild={handleAddChild}
          />
        ) : (
          <TimelineView data={data} onFocus={handleFocus} />
        )}
      </div>

      <aside
        className={`hud${warning ? ' hud-warning' : ''}`}
        style={{ '--needle': `${gaugeAngle}deg` } as CSSProperties}
      >
        <div className="hud-title">
          <span>URL Capacity</span>
          <span className="hud-status">{statusLabel}</span>
        </div>
        <div className="gauge">
          <svg viewBox="0 0 200 110" aria-hidden="true">
            <path
              d="M20 100 A80 80 0 0 1 180 100"
              stroke="#2f3647"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
            />
            <g stroke="#55607a" strokeWidth="2">
              <line x1="100" y1="16" x2="100" y2="28" transform="rotate(-110 100 100)" />
              <line x1="100" y1="16" x2="100" y2="28" transform="rotate(-55 100 100)" />
              <line x1="100" y1="16" x2="100" y2="28" />
              <line x1="100" y1="16" x2="100" y2="28" transform="rotate(55 100 100)" />
              <line x1="100" y1="16" x2="100" y2="28" transform="rotate(110 100 100)" />
            </g>
          </svg>
          <div className="gauge-needle" />
          <div className="gauge-center" />
        </div>
        <div className="hud-readout">
          <strong>{urlLength.toLocaleString()}</strong>
          <span>
            Soft {SOFT_LIMIT} / Hard {HARD_LIMIT} / Danger {DANGER_LIMIT}
          </span>
        </div>
        {showShrink ? (
          <div className="shrink-list">
            {shrinkOptions.map((option) => (
              <div key={option.id} className="shrink-card">
                <h5>{option.title}</h5>
                <p>{option.description}</p>
                <button
                  onClick={() => {
                    option.apply()
                    showToast('短縮を適用しました')
                  }}
                  disabled={!option.enabled}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      {toast ? <div className="toast">{toast.message}</div> : null}
    </div>
  )
}

function getDoneRate(data: TreeData) {
  if (data.nodes.length === 0) return 0
  const doneCount = data.nodes.filter((node) => node.s === 2).length
  return doneCount / data.nodes.length
}
