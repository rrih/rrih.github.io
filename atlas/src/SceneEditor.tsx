import {
  ChevronDown,
  Download,
  FolderOpen,
  Grid2X2,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { art, filterPokemon, models, pokemon } from './catalog'
import FormSelect from './FormSelect'
import { findForm, formLabel, modelFor } from './forms'
import { useLocale } from './i18n'
import { MAX_MEMBERS, MAX_SCENES, type SavedScene, type SceneMember } from './sceneStudio'
import type { Pokemon } from './types'
import './scene-editor.css'

export interface SceneEditorProps {
  members: SceneMember[]
  onChange: (members: SceneMember[]) => void
  name: string
  onNameChange: (name: string) => void
  saved: SavedScene[]
  onSave: () => void
  onOpen: (scene: SavedScene) => void
  onDelete: (id: string) => void
  onDownload: () => void
  onImport: (file: File) => void
  storageFailed: boolean
}

const entries = new Map(pokemon.map((entry) => [entry.id, entry]))
const popular = [25, 6, 1, 7, 133, 151, 39, 143]
  .map((id) => entries.get(id))
  .filter((entry): entry is Pokemon => !!entry && !!models[entry.id]?.url)
const insertionPoints = [
  [-3.2, -3.2],
  [3.2, 3.2],
  [3.2, -3.2],
  [-3.2, 3.2],
  [-3.2, 0],
  [3.2, 0],
  [0, -3.2],
  [0, 3.2],
  [0, 0],
]

export default function SceneEditor({
  members,
  onChange,
  name,
  onNameChange,
  saved,
  onSave,
  onOpen,
  onDelete,
  onDownload,
  onImport,
  storageFailed,
}: SceneEditorProps) {
  const { t, number, species } = useLocale()
  const id = useId()
  const [selectedKey, setSelectedKey] = useState(members[0]?.key || '')
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [visibleResults, setVisibleResults] = useState(12)
  const search = useRef<HTMLInputElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const selectedEditor = useRef<HTMLDivElement>(null)
  const selected = members.find((member) => member.key === selectedKey) || members[0]
  const selectedEntry = selected && entries.get(selected.speciesId)
  const selectedDetails = selectedEntry && species(selectedEntry)
  const results = useMemo(
    () =>
      query.trim() ? filterPokemon(query, 0, '', null).filter((entry) => !!models[entry.id]?.url) : popular,
    [query],
  )

  useEffect(() => {
    if (!adding) return
    const frame = requestAnimationFrame(() => search.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [adding])

  function focusEditor() {
    requestAnimationFrame(() => selectedEditor.current?.querySelector<HTMLInputElement>('input')?.focus())
  }

  function add(entry: Pokemon) {
    if (members.length >= MAX_MEMBERS || !models[entry.id]?.url) return
    const distance = ([x, z]: number[]) =>
      members.length ? Math.min(...members.map((member) => Math.hypot(member.x - x, member.z - z))) : 0
    const [x, z] = members.length
      ? insertionPoints.reduce((best, point) => (distance(point) > distance(best) ? point : best))
      : [0, 0]
    const member: SceneMember = {
      key: crypto.randomUUID(),
      speciesId: entry.id,
      shiny: false,
      x,
      z,
      rotation: 0,
      scale: 1,
    }
    onChange([...members, member])
    setSelectedKey(member.key)
    setAdding(false)
    setQuery('')
    setVisibleResults(12)
    focusEditor()
  }

  function change(patch: Partial<Pick<SceneMember, 'x' | 'z' | 'rotation' | 'scale' | 'shiny' | 'formId'>>) {
    if (!selected) return
    onChange(members.map((member) => (member.key === selected.key ? { ...member, ...patch } : member)))
  }

  function arrange() {
    const columns = members.length <= 3 ? members.length : 2
    const rows = Math.ceil(members.length / columns)
    onChange(
      members.map((member, index) => {
        const row = Math.floor(index / columns)
        const rowCount = Math.min(columns, members.length - row * columns)
        return {
          ...member,
          x: ((index % columns) - (rowCount - 1) / 2) * 3.3,
          z: (row - (rows - 1) / 2) * 3.1,
        }
      }),
    )
  }

  function remove() {
    if (!selected || members.length <= 1) return
    const index = members.findIndex((member) => member.key === selected.key)
    setSelectedKey(members[(index + 1) % members.length].key)
    onChange(members.filter((member) => member.key !== selected.key))
    focusEditor()
  }

  const range = (
    field: 'x' | 'z' | 'rotation' | 'scale',
    label: string,
    min: number,
    max: number,
    step: number,
  ) => {
    if (!selected) return null
    const value = selected[field]
    const formatted = number(value, { maximumFractionDigits: field === 'scale' ? 2 : 1 })
    const unit = field === 'rotation' ? '°' : field === 'scale' ? '×' : ''
    return (
      <label className="scene-range" htmlFor={`${id}-${field}`}>
        <span>
          <span>{label}</span>
          <output htmlFor={`${id}-${field}`}>
            <bdi>
              {formatted}
              {unit}
            </bdi>
          </output>
        </span>
        <input
          id={`${id}-${field}`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          dir="ltr"
          aria-label={label}
          aria-valuetext={`${formatted}${unit}`}
          onChange={(event) => change({ [field]: Number(event.currentTarget.value) })}
        />
      </label>
    )
  }

  return (
    <section className="scene-editor" aria-label={t('Your scene')}>
      <header className="scene-editor-heading">
        <div>
          <h2>{t('Your scene')}</h2>
        </div>
        <span className="scene-member-count">
          <span className="sr-only">{t('{count} Pokémon', { count: number(members.length) })}</span>
          <bdi aria-hidden="true">
            {number(members.length)} / {number(MAX_MEMBERS)}
          </bdi>
        </span>
      </header>

      <form
        className="scene-name-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) onSave()
        }}
      >
        <label htmlFor={`${id}-name`}>
          <span>{t('Scene name')}</span>
          <input
            id={`${id}-name`}
            value={name}
            maxLength={120}
            autoComplete="off"
            onChange={(event) => onNameChange(Array.from(event.currentTarget.value).slice(0, 60).join(''))}
          />
        </label>
        <button type="submit" className="scene-button scene-button-primary" disabled={!name.trim()}>
          <Save size={15} aria-hidden="true" />
          <span>{t('Save scene')}</span>
        </button>
      </form>
      {!storageFailed && <p className="scene-help">{t('Changes are saved on this device.')}</p>}
      {storageFailed && (
        <p className="scene-storage-error" role="status">
          {t('This scene could not be saved on this device.')}
        </p>
      )}

      <fieldset className="scene-members" aria-label={t('Your scene')}>
        {members.map((member, index) => {
          const entry = entries.get(member.speciesId)
          if (!entry) return null
          const localized = species(entry)
          const memberForm = findForm(member.speciesId, member.formId)
          return (
            <button
              type="button"
              key={member.key}
              className={`scene-member ${member.key === selected?.key ? 'is-selected' : ''}`}
              aria-pressed={member.key === selected?.key}
              aria-label={`${t('Edit {name}', { name: localized.name })} · ${number(index + 1)}`}
              onClick={() => setSelectedKey(member.key)}
            >
              <span className="scene-member-number" aria-hidden="true">
                {number(index + 1)}
              </span>
              <img
                src={art(member.speciesId)}
                alt=""
                width="48"
                height="48"
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.style.visibility = 'hidden'
                }}
              />
              <span>
                <bdi lang={localized.nameLang}>{localized.name}</bdi>
              </span>
              {memberForm && <small>{formLabel(memberForm, t)}</small>}
              {member.shiny && <Sparkles className="scene-shiny-badge" size={12} aria-hidden="true" />}
            </button>
          )
        })}
      </fieldset>
      <div className="scene-member-actions">
        <button
          type="button"
          ref={addButton}
          className="scene-button"
          disabled={members.length >= MAX_MEMBERS}
          aria-expanded={adding}
          aria-controls={`${id}-search-panel`}
          onClick={() => setAdding((value) => !value)}
        >
          <Plus size={15} aria-hidden="true" />
          <span>{t('Add a Pokémon')}</span>
        </button>
        <button type="button" className="scene-button" onClick={arrange} disabled={!members.length}>
          <Grid2X2 size={15} aria-hidden="true" />
          <span>{t('Arrange automatically')}</span>
        </button>
      </div>
      <p className="scene-help">
        {t('Up to {count} Pokémon can share a scene.', { count: number(MAX_MEMBERS) })}
      </p>

      <div id={`${id}-search-panel`} className="scene-add-panel" hidden={!adding}>
        <label className="scene-search" htmlFor={`${id}-search`}>
          <Search size={16} aria-hidden="true" />
          <input
            ref={search}
            id={`${id}-search`}
            type="search"
            autoComplete="off"
            value={query}
            aria-label={t('Search Pokémon to add')}
            placeholder={t('Search Pokémon to add')}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                setAdding(false)
                addButton.current?.focus()
              }
            }}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setVisibleResults(12)
            }}
          />
        </label>
        <div className="scene-search-results">
          {results.slice(0, visibleResults).map((entry) => {
            const localized = species(entry)
            return (
              <button
                type="button"
                key={entry.id}
                className="scene-search-result"
                disabled={members.length >= MAX_MEMBERS}
                aria-label={t('Add {name} to scene', { name: localized.name })}
                onClick={() => add(entry)}
              >
                <img
                  src={art(entry.id)}
                  alt=""
                  width="36"
                  height="36"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.visibility = 'hidden'
                  }}
                />
                <span>
                  <bdi lang={localized.nameLang}>{localized.name}</bdi>
                  <small>
                    <bdi>#{String(entry.id).padStart(3, '0')}</bdi>
                  </small>
                </span>
                <Plus size={13} aria-hidden="true" />
              </button>
            )
          })}
        </div>
        {!results.length && (
          <p className="scene-help" role="status">
            {t('No Pokémon found.')}
          </p>
        )}
        {results.length > visibleResults && (
          <button
            type="button"
            className="scene-button scene-more"
            onClick={() => setVisibleResults((value) => value + 12)}
          >
            {t('Discover more')}
          </button>
        )}
      </div>

      {selected && selectedDetails && (
        <div className="scene-selected-editor" ref={selectedEditor}>
          <div className="scene-selected-heading">
            <h3>
              <bdi lang={selectedDetails.nameLang}>{selectedDetails.name}</bdi>
            </h3>
            <button
              type="button"
              className="scene-icon-button"
              disabled={members.length <= 1}
              onClick={remove}
              aria-label={t('Remove {name} from scene', { name: selectedDetails.name })}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
          <FormSelect
            speciesId={selected.speciesId}
            value={selected.formId}
            onChange={(formId) =>
              change({
                formId: formId || undefined,
                shiny: selected.shiny && !!modelFor(selected.speciesId, formId)?.shiny,
              })
            }
          />
          <fieldset className="scene-position">
            <legend>{t('Position')}</legend>
            <div className="scene-ranges">
              {range('x', t('Left / right'), -4, 4, 0.1)}
              {range('z', t('Near / far'), -4, 4, 0.1)}
            </div>
          </fieldset>
          <div className="scene-ranges">
            {range('rotation', t('Direction'), -180, 180, 5)}
            {range('scale', t('Size'), 0.4, 1.6, 0.05)}
          </div>
          {modelFor(selected.speciesId, selected.formId)?.shiny && (
            <button
              type="button"
              className={`scene-button scene-shiny-toggle ${selected.shiny ? 'is-selected' : ''}`}
              aria-pressed={selected.shiny}
              onClick={() => change({ shiny: !selected.shiny })}
            >
              <Sparkles size={15} aria-hidden="true" />
              <span>{t('Shiny appearance')}</span>
            </button>
          )}
        </div>
      )}

      <details className="scene-saved">
        <summary>
          <span>{t('Saved scenes')}</span>
          <bdi>{number(saved.length)}</bdi>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        {saved.length ? (
          <ul>
            {saved.map((scene) => (
              <li key={scene.id}>
                <button
                  type="button"
                  className="scene-open"
                  aria-label={`${t('Open scene')}: ${scene.name}`}
                  onClick={() => {
                    onOpen(scene)
                    setSelectedKey(scene.members[0]?.key || '')
                    setAdding(false)
                  }}
                >
                  <FolderOpen size={17} aria-hidden="true" />
                  <span>
                    <strong>
                      <bdi>{scene.name}</bdi>
                    </strong>
                    <small>{t('{count} Pokémon', { count: number(scene.members.length) })}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="scene-icon-button"
                  aria-label={`${t('Delete scene')}: ${scene.name}`}
                  onClick={() => {
                    if (window.confirm(t('Delete scene "{name}"?', { name: scene.name }))) onDelete(scene.id)
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="scene-help">{t('No saved scenes yet.')}</p>
        )}
        <p className="scene-help">{t('You can save up to {count} scenes.', { count: number(MAX_SCENES) })}</p>
      </details>
      <div className="scene-file-actions">
        <button type="button" className="scene-button" onClick={onDownload}>
          <Download size={15} aria-hidden="true" />
          <span>{t('Download scene')}</span>
        </button>
        <button type="button" className="scene-button" onClick={() => importInput.current?.click()}>
          <Upload size={15} aria-hidden="true" />
          <span>{t('Import scene')}</span>
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) onImport(file)
          }}
        />
      </div>
    </section>
  )
}
