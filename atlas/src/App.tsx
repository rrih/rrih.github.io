import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Expand,
  Heart,
  Languages,
  Layers3,
  LoaderCircle,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { lazy, type MouseEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdSlot from './AdSlot'
import { AD_CLIENT, AD_SLOT, useAdvertising } from './advertising'
import BackgroundPicker from './BackgroundPicker'
import { loadBackground } from './backgroundStore'
import { cacheOpenedView, retainInstalledStorage } from './cache'
import { art, filterPokemon, generations, pokemon, readFavorites, typeColors } from './catalog'
import FormSelect from './FormSelect'
import { findForm, formLabel, formPokemon, formsFor, modelFor } from './forms'
import { useLocale } from './i18n'
import { isRTL, locales, normalizeSearch } from './locales'
import { Privacy } from './Privacy'
import { applyPageSeo } from './pageHead'
import { previewImage } from './previews'
import { type AtlasPage, assetPath, atlasPath, parseAtlasRoute, seoLocale } from './routes'
import SceneEditor from './SceneEditor'
import { exportScene, readSceneFile } from './sceneFiles'
import { decodeSceneLink, encodeSceneLink } from './sceneLink'
import {
  type CameraPose,
  MAX_SCENES,
  parseScene,
  readStudio,
  type SavedScene,
  type StudioState,
  writeStudio,
} from './sceneStudio'
import { buildIndexSeo, buildPokemonSeo, seoWords } from './seo'
import {
  habitatNames,
  habitats,
  isHabitat,
  type Pokemon,
  type ViewerHandle,
  type ViewerSettings,
} from './types'
import { useDeferredSW } from './useDeferredSW'

const Viewer = lazy(() => import('./Viewer'))
const initialHash = () => new URLSearchParams(location.hash.slice(1))
const initialId = () => {
  const route = parseAtlasRoute(location.pathname)
  return route?.kind === 'pokemon' ? route.id : Number(initialHash().get('pokemon')) || 6
}
const initialForm = () => {
  const route = parseAtlasRoute(location.pathname)
  return route?.kind === 'pokemon' ? route.formId || initialHash().get('form') : initialHash().get('form')
}
const uiHref = (page: AtlasPage, locale: string) =>
  atlasPath(page, locale) + (seoLocale(locale) === locale ? '' : `?lang=${encodeURIComponent(locale)}`)
const follow = (event: MouseEvent<HTMLAnchorElement>, action: () => void) => {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  action()
}
const defaultSettings: ViewerSettings = {
  playing: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  rotate: false,
  speed: 1,
  light: 1,
  habitat: 'studio',
  wireframe: false,
  shiny: false,
  quality: 'high',
  animation: 0,
}
interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

function storedBackground(): string | undefined {
  try {
    const id = localStorage.getItem('atlas-background')
    return id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

function TypePill({ type }: { type: string }) {
  const { typeName, locale } = useLocale()
  return (
    <a
      href={atlasPath({ kind: 'type', type }, locale)}
      className="type-pill"
      style={{ color: typeColors[type], borderColor: `${typeColors[type]}40` }}
    >
      <i style={{ background: typeColors[type] }} />
      {typeName(type)}
    </a>
  )
}

function PokemonCard({
  entry,
  active,
  saved,
  onSelect,
  formId,
}: {
  entry: Pokemon
  active: boolean
  saved: boolean
  onSelect: () => void
  formId?: string
}) {
  const { t, species, locale } = useLocale()
  const localized = species(entry)
  return (
    <a
      href={uiHref({ kind: 'pokemon', id: entry.id, formId }, locale)}
      className={`pokemon-card ${active ? 'selected' : ''}`}
      onClick={(event) => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault()
          onSelect()
        }
      }}
      aria-current={active ? 'true' : undefined}
      aria-label={t('View {name}', { name: localized.name })}
    >
      <span className="card-number">{String(entry.id).padStart(3, '0')}</span>
      {saved && <Heart className="card-heart" size={12} fill="currentColor" />}
      <img
        src={art(entry.id)}
        alt=""
        loading="lazy"
        width="90"
        height="90"
        onError={(e) => {
          e.currentTarget.style.visibility = 'hidden'
        }}
      />
      <span className="card-name">
        <bdi lang={localized.nameLang}>{localized.name}</bdi>
      </span>
      <span className="card-types">
        {entry.types.map((type) => (
          <i key={type} style={{ background: typeColors[type] }} />
        ))}
      </span>
    </a>
  )
}

export default function App() {
  const {
    locale,
    chooseLocale,
    t,
    number: fmt,
    species,
    typeName,
    catalogStatus,
    retryCatalog,
    localeName,
    preferenceSaved,
    languageStatus,
    retryLanguage,
  } = useLocale()
  const advertising = useAdvertising(locale)
  const generationName = (index: number) =>
    index
      ? t('Generation {number}', {
          number: locale === 'en' ? generations[index].replace('Generation ', '') : fmt(index),
        })
      : t('All generations')
  const [languageQuery, setLanguageQuery] = useState('')
  const [selected, setSelected] = useState(() => pokemon.find((p) => p.id === initialId()) || pokemon[5])
  const [formId, setFormId] = useState(() => findForm(initialId(), initialForm())?.id || '')
  const [pageMode, setPageMode] = useState<'home' | 'pokemon'>(() =>
    parseAtlasRoute(location.pathname)?.kind === 'home' ? 'home' : 'pokemon',
  )
  const [formKind, setFormKind] = useState('')
  const [backgroundUrl, setBackgroundUrl] = useState<string>()
  const [backgroundFailed, setBackgroundFailed] = useState(false)
  const [backgroundAttempt, setBackgroundAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [gen, setGen] = useState(0)
  const [type, setType] = useState('')
  const [favorites, setFavorites] = useState(readFavorites)
  const [savedOnly, setSavedOnly] = useState(false)
  const [limit, setLimit] = useState(40)
  const [incomingScene] = useState(() =>
    initialHash().get('view') === 'together' ? decodeSceneLink(initialHash().get('layout')) : null,
  )
  const [studioState, setStudioState] = useState<StudioState>(() => {
    const state = readStudio()
    const hash = initialHash()
    if (incomingScene) return { ...state, active: true, draft: { ...incomingScene, name: t('Your scene') } }
    if (hash.has('layout')) return { ...state, active: false }
    const explicit = hash.has('pokemon') || /\/pokemon\/\d+\//.test(location.pathname)
    return {
      ...state,
      active: hash.get('view') === 'together' ? !!state.draft : explicit ? false : state.active,
    }
  })
  const together = studioState.active && !!studioState.draft
  const [storageFailed, setStorageFailed] = useState(false)
  const pendingCamera = useRef<CameraPose | undefined>(together ? studioState.draft?.camera : undefined)
  const [settings, setSettings] = useState<ViewerSettings>(() =>
    together && studioState.draft
      ? {
          ...studioState.draft.settings,
          playing: studioState.draft.settings.playing && defaultSettings.playing,
        }
      : {
          ...defaultSettings,
          habitat: isHabitat(initialHash().get('scene'))
            ? (initialHash().get('scene') as ViewerSettings['habitat'])
            : 'studio',
          shiny: initialHash().get('shiny') === '1' && !!modelFor(initialId(), formId)?.shiny,
          backgroundId: storedBackground(),
        },
  )
  const [animations, setAnimations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [tab, setTab] = useState<'overview' | 'studio'>('overview')
  const [dialog, setDialog] = useState<'help' | 'about' | 'install' | 'language' | null>(null)
  const [notice, setNotice] = useState(() =>
    initialHash().has('layout') && !incomingScene ? 'Preview unavailable' : '',
  )
  const [install, setInstall] = useState<InstallPrompt | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [mobileCollection, setMobileCollection] = useState(false)
  const [focus, setFocus] = useState(false)
  const stateRef = useRef({ id: selected.id, formId, settings })
  stateRef.current = { id: selected.id, formId, settings }
  const viewer = useRef<ViewerHandle>(null)
  const studio = useRef<HTMLElement>(null)
  const modal = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const collection = useRef<HTMLDivElement>(null)
  const languageSearch = useRef<HTMLInputElement>(null)
  const updateRequested = useRef(false)
  const reloading = useRef(false)
  const reloadUpdatedApp = useCallback(() => {
    if (reloading.current) return
    reloading.current = true
    window.location.reload()
  }, [])
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useDeferredSW(!loading || !!error, { onNeedReload: reloadUpdatedApp })

  async function applyAppUpdate() {
    updateRequested.current = true
    const registration = await navigator.serviceWorker.getRegistration('/atlas/')
    if (registration?.waiting) await updateServiceWorker(true)
    else reloadUpdatedApp()
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: A retry deliberately reopens local storage.
  useEffect(() => {
    let cancelled = false
    let url: string | undefined
    setBackgroundUrl(undefined)
    setBackgroundFailed(false)
    if (!settings.backgroundId) {
      if (settings.habitat === 'custom') setSettings((s) => ({ ...s, habitat: 'studio' }))
      return
    }
    void loadBackground(settings.backgroundId)
      .then((image) => {
        if (cancelled) {
          if (image) URL.revokeObjectURL(image.url)
          return
        }
        if (!image) throw new Error('Missing image')
        url = image.url
        setBackgroundUrl(image.url)
      })
      .catch(() => {
        if (!cancelled) {
          setBackgroundFailed(true)
        }
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [settings.backgroundId, settings.habitat, backgroundAttempt])

  const formMatchesQuery = (form: ReturnType<typeof formsFor>[number]) =>
    !query.trim() ||
    normalizeSearch(`${Object.values(form.names).join(' ')} ${form.name}`).includes(normalizeSearch(query))
  const formChoice = (entry: Pokemon) => {
    const baseMatches = filterPokemon(query, 0, '', null).some((base) => base.id === entry.id)
    if (!formKind && baseMatches && (!type || entry.types.includes(type))) return undefined
    return formsFor(entry.id).find(
      (form) =>
        (!formKind || form.kind === formKind) &&
        (!type || form.types.includes(type)) &&
        (baseMatches || formMatchesQuery(form)),
    )
  }
  const filtered = useMemo(() => {
    const favoriteFilter = savedOnly ? favorites : null
    const baseMatches = new Set(filterPokemon(query, gen, '', favoriteFilter).map((entry) => entry.id))
    return filterPokemon('', gen, '', favoriteFilter).filter((entry) => {
      const alternatives = formsFor(entry.id).filter((form) => !formKind || form.kind === formKind)
      if (formKind)
        return alternatives.some(
          (form) =>
            (baseMatches.has(entry.id) ||
              !query.trim() ||
              normalizeSearch(`${Object.values(form.names).join(' ')} ${form.name}`).includes(
                normalizeSearch(query),
              )) &&
            (!type || form.types.includes(type)),
        )
      return (
        (baseMatches.has(entry.id) && (!type || entry.types.includes(type))) ||
        (!!query.trim() &&
          alternatives.some(
            (form) =>
              normalizeSearch(`${Object.values(form.names).join(' ')} ${form.name}`).includes(
                normalizeSearch(query),
              ) &&
              (!type || form.types.includes(type)),
          ))
      )
    })
  }, [query, gen, type, savedOnly, favorites, formKind])
  const evolution = useMemo(
    () => pokemon.filter((p) => p.evolvesFrom === selected.id || p.id === selected.evolvesFrom),
    [selected],
  )
  const activeForm = findForm(selected.id, formId)
  const displayed = formPokemon(selected, activeForm)
  const baseDetails = species(selected)
  const details = activeForm
    ? {
        ...baseDetails,
        name: activeForm.names[locale] || `${baseDetails.name} (${formLabel(activeForm, t)})`,
        nameLang: activeForm.names[locale] ? locale : baseDetails.nameLang,
      }
    : baseDetails
  const model = modelFor(selected.id, formId)
  const index = filtered.findIndex((p) => p.id === selected.id)
  const modelUrl = settings.shiny && model?.shiny ? model.shiny : model?.url
  const openedUrls = JSON.stringify(
    together
      ? studioState.draft?.members.map((member) =>
          member.shiny
            ? modelFor(member.speciesId, member.formId).shiny || modelFor(member.speciesId, member.formId).url
            : modelFor(member.speciesId, member.formId).url,
        )
      : [modelUrl].filter(Boolean),
  )

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const controlled = () => {
      if (updateRequested.current) reloadUpdatedApp()
      else void cacheOpenedView(JSON.parse(openedUrls))
    }
    navigator.serviceWorker.addEventListener('controllerchange', controlled)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', controlled)
  }, [openedUrls, reloadUpdatedApp])

  useEffect(() => {
    const installed = () => void retainInstalledStorage()
    if (
      matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && navigator.standalone === true)
    )
      installed()
    window.addEventListener('appinstalled', installed)
    return () => window.removeEventListener('appinstalled', installed)
  }, [])

  const snapshot =
    together && studioState.draft
      ? {
          ...studioState,
          draft: { ...studioState.draft, name: studioState.draft.name.trim() || t('Your scene'), settings },
        }
      : studioState
  const snapshotRef = useRef({ state: snapshot, loading })
  snapshotRef.current = { state: snapshot, loading }
  useEffect(() => {
    if (studioState.draft || studioState.saved.length) {
      const state =
        studioState.active && studioState.draft
          ? {
              ...studioState,
              draft: {
                ...studioState.draft,
                name: studioState.draft.name.trim() || t('Your scene'),
                settings,
              },
            }
          : studioState
      setStorageFailed(!writeStudio(state))
    }
  }, [studioState, settings, t])
  useEffect(() => {
    const persist = () => {
      const { state, loading } = snapshotRef.current
      if (!state.draft) return
      const camera = !loading && state.active ? viewer.current?.getCamera() : state.draft.camera
      writeStudio({ ...state, draft: { ...state.draft, camera } })
    }
    const visibility = () => {
      if (document.hidden) persist()
    }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  function leaveTogether() {
    const draft = sceneSnapshot()
    pendingCamera.current = undefined
    setStudioState((state) => ({ ...state, active: false, draft: draft || state.draft }))
    setSettings((value) => ({ ...value, shiny: false, animation: 0 }))
  }
  function enterTogether() {
    if (together) return
    setTab('studio')
    const draft = studioState.draft || {
      id: crypto.randomUUID(),
      name: t('Your scene'),
      members: [
        {
          key: crypto.randomUUID(),
          speciesId: selected.id,
          ...(formId ? { formId } : {}),
          shiny: settings.shiny && !!model?.shiny,
          x: 0,
          z: 0,
          rotation: 0,
          scale: 1,
        },
      ],
      settings,
    }
    pendingCamera.current = draft.camera
    setSettings({ ...draft.settings, playing: draft.settings.playing && defaultSettings.playing })
    setStudioState((state) => ({ ...state, active: true, draft }))
  }
  function sceneSnapshot(): SavedScene | null {
    if (!studioState.draft) return null
    return parseScene({
      ...studioState.draft,
      name: studioState.draft.name.trim() || t('Your scene'),
      settings,
      camera: !loading ? viewer.current?.getCamera() : studioState.draft.camera,
    })
  }
  function saveScene() {
    const draft = sceneSnapshot()
    if (!draft) return
    const existing = studioState.saved.find((scene) => scene.name === draft.name)
    if (!existing && studioState.saved.length >= MAX_SCENES) {
      setNotice(t('You can save up to {count} scenes.', { count: fmt(MAX_SCENES) }))
      return
    }
    draft.id = existing?.id || crypto.randomUUID()
    const state = {
      ...studioState,
      draft,
      saved: existing
        ? studioState.saved.map((scene) => (scene.id === existing.id ? draft : scene))
        : [...studioState.saved, draft],
    }
    const success = writeStudio(state)
    setStudioState(state)
    setStorageFailed(!success)
    setNotice(success ? 'Scene saved on this device.' : 'This scene could not be saved on this device.')
  }
  function openScene(scene: SavedScene) {
    const identity = (members: SavedScene['members']) =>
      JSON.stringify(members.map(({ key, speciesId, shiny, formId }) => ({ key, speciesId, shiny, formId })))
    const needsLoad =
      !together || !studioState.draft || identity(studioState.draft.members) !== identity(scene.members)
    pendingCamera.current = needsLoad ? scene.camera : undefined
    setSettings({ ...scene.settings, playing: scene.settings.playing && defaultSettings.playing })
    setStudioState((state) => ({ ...state, active: true, draft: scene }))
    // Existing members need no reload when only the stored layout or camera differs.
    if (scene.camera && !needsLoad)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => viewer.current?.restoreCamera(scene.camera as CameraPose)),
      )
  }
  async function downloadScene() {
    const scene = sceneSnapshot()
    if (!scene) return
    try {
      const url = URL.createObjectURL(new Blob([await exportScene(scene)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'pokemon-atlas-scene.json'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setNotice('This scene could not be downloaded.')
    }
  }
  async function importScene(file: File) {
    try {
      openScene(await readSceneFile(file))
      setNotice('Scene imported.')
    } catch {
      setNotice('This scene file could not be opened.')
    }
  }

  const update = (patch: Partial<ViewerSettings>) => setSettings((s) => ({ ...s, ...patch }))

  function choose(entry: Pokemon) {
    setPageMode('pokemon')
    const nextForm = formChoice(entry)?.id || ''
    if (entry.id === selected.id && nextForm === formId) {
      setMobileCollection(false)
      return
    }
    setSelected(entry)
    setFormId(nextForm)
    if (!together) {
      setAnimations([])
      setError('')
      setLoading(true)
      update({ shiny: false, animation: 0 })
    }
    setMobileCollection(false)
  }

  function neighbor(direction: number) {
    const entries = filtered.length ? filtered : pokemon
    const current = entries.findIndex((p) => p.id === selected.id)
    return entries[
      current < 0
        ? direction > 0
          ? 0
          : entries.length - 1
        : (current + direction + entries.length) % entries.length
    ]
  }
  const move = (direction: number) => choose(neighbor(direction))
  function chooseForm(id: string) {
    setPageMode('pokemon')
    setFormId(id)
    setLoading(true)
    setError('')
    setAnimations([])
    update({ shiny: settings.shiny && !!modelFor(selected.id, id)?.shiny, animation: 0 })
  }

  const page: AtlasPage =
    together || pageMode === 'home'
      ? { kind: 'home' }
      : { kind: 'pokemon', id: selected.id, ...(formId ? { formId } : {}) }
  const pageSeo =
    page.kind === 'home'
      ? buildIndexSeo(page, locale)
      : buildPokemonSeo({
          pokemon: displayed,
          localized: details,
          locale,
          form: activeForm,
          baseName: baseDetails.name,
          typeNames: displayed.types.map(typeName),
          image: previewImage(selected.id, activeForm?.id),
          ogImage: previewImage(selected.id, activeForm?.id),
        })
  const serializedSeo = JSON.stringify(pageSeo)
  useEffect(() => {
    if (catalogStatus !== 'ready') return
    applyPageSeo(JSON.parse(serializedSeo))
  }, [serializedSeo, catalogStatus])
  const sceneToken =
    together && studioState.draft
      ? encodeSceneLink({ ...studioState.draft, name: t('Your scene'), settings })
      : null
  useEffect(() => {
    const hash = new URLSearchParams({ pokemon: String(selected.id), scene: settings.habitat })
    if (settings.shiny) hash.set('shiny', '1')
    if (formId) hash.set('form', formId)
    if (together) {
      hash.set('view', 'together')
      if (sceneToken) hash.set('layout', sceneToken)
    }
    const destination: AtlasPage =
      together || pageMode === 'home'
        ? { kind: 'home' }
        : { kind: 'pokemon', id: selected.id, ...(formId ? { formId } : {}) }
    const url = new URL(uiHref(destination, locale), location.origin)
    if (new URLSearchParams(location.search).get('privacy') === '1') url.searchParams.set('privacy', '1')
    url.hash = hash.toString()
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [selected.id, pageMode, together, settings.habitat, settings.shiny, formId, locale, sceneToken])

  useEffect(() => {
    const change = () => {
      const hash = initialHash()
      const shared = hash.get('view') === 'together' ? decodeSceneLink(hash.get('layout')) : null
      if (hash.has('layout')) {
        if (!shared) {
          setNotice('Preview unavailable')
          return
        }
        const stored = snapshotRef.current.state
        const members = shared.members
        pendingCamera.current = shared.camera
        setPageMode('home')
        setSelected(pokemon.find((entry) => entry.id === members[0].speciesId) || pokemon[5])
        setFormId(members[0].formId || '')
        setStudioState({
          ...stored,
          active: true,
          draft: { ...shared, name: stored.draft?.name || 'Shared scene' },
        })
        setSettings({ ...shared.settings, playing: shared.settings.playing && defaultSettings.playing })
        setError('')
        setAnimations([])
        setLoading(true)
        setReload((value) => value + 1)
        return
      }
      const entry = pokemon.find((p) => p.id === initialId())
      if (!entry) return
      const current = stateRef.current
      const habitat = isHabitat(hash.get('scene'))
        ? (hash.get('scene') as ViewerSettings['habitat'])
        : 'studio'
      const nextForm = findForm(entry.id, initialForm())?.id || ''
      setPageMode(parseAtlasRoute(location.pathname)?.kind === 'home' ? 'home' : 'pokemon')
      const shiny = hash.get('shiny') === '1' && !!modelFor(entry.id, nextForm)?.shiny
      const changed =
        current.id !== entry.id || current.formId !== nextForm || current.settings.shiny !== shiny
      const stored = snapshotRef.current.state
      if (hash.get('view') === 'together' && stored.draft) {
        pendingCamera.current = stored.draft.camera
        setStudioState({ ...stored, active: true })
        setSettings({
          ...stored.draft.settings,
          playing: stored.draft.settings.playing && defaultSettings.playing,
        })
        return
      }
      setStudioState({
        ...stored,
        active: false,
        draft: stored.draft
          ? {
              ...stored.draft,
              camera:
                !snapshotRef.current.loading && stored.active
                  ? viewer.current?.getCamera()
                  : stored.draft.camera,
            }
          : null,
      })
      pendingCamera.current = undefined
      setSelected(entry)
      setFormId(nextForm)
      setSettings((s) => ({ ...s, habitat, shiny, animation: changed ? 0 : s.animation }))
      if (changed) {
        setError('')
        setAnimations([])
        setLoading(true)
      }
    }
    window.addEventListener('hashchange', change)
    window.addEventListener('popstate', change)
    return () => {
      window.removeEventListener('hashchange', change)
      window.removeEventListener('popstate', change)
    }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstall(e as InstallPrompt)
    }
    const online = () => setOffline(!navigator.onLine)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('online', online)
    window.addEventListener('offline', online)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', online)
    }
  }, [])

  useEffect(() => {
    const media = matchMedia('(max-width: 700px)')
    const close = () => setMobileCollection(false)
    media.addEventListener('change', close)
    return () => media.removeEventListener('change', close)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (dialog && !modal.current?.open) modal.current?.showModal()
    if (!dialog && modal.current?.open) modal.current?.close()
    if (dialog === 'language') requestAnimationFrame(() => languageSearch.current?.focus())
  }, [dialog])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocus(false)
        setMobileCollection(false)
      }
      if (dialog || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes((e.target as HTMLElement).tagName))
        return
      if (e.key === '/') {
        e.preventDefault()
        setMobileCollection(true)
        requestAnimationFrame(() => search.current?.focus())
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        move(isRTL(locale) ? -1 : 1)
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        move(isRTL(locale) ? 1 : -1)
      }
      if (e.code === 'Space') {
        e.preventDefault()
        setSettings((s) => ({ ...s, playing: !s.playing }))
      }
      if (e.key === 'Escape') setFocus(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  function toggleFavorite() {
    const next = new Set(favorites)
    if (next.has(selected.id)) next.delete(selected.id)
    else next.add(selected.id)
    setFavorites(next)
    try {
      localStorage.setItem('atlas-favorites', JSON.stringify([...next]))
    } catch {
      setNotice('Saved for this visit. Your browser could not store this collection.')
    }
  }

  async function share() {
    try {
      const url = new URL(location.href)
      if (together) {
        const scene = sceneSnapshot()
        const token = scene && encodeSceneLink(scene)
        if (!token) {
          setNotice('Preview unavailable')
          return
        }
        const hash = new URLSearchParams(url.hash.slice(1))
        hash.set('view', 'together')
        hash.set('layout', token)
        url.hash = hash.toString()
      }
      if (settings.habitat === 'custom') {
        const hash = new URLSearchParams(url.hash.slice(1))
        hash.set('scene', 'studio')
        url.hash = hash.toString()
      }
      if (together) history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      await navigator.clipboard.writeText(url.href)
      setNotice('Link copied.')
    } catch {
      setNotice('Copy the address from your browser to share this Pokémon.')
    }
  }

  async function installApp() {
    chooseLocale(locale)
    if (install) {
      await install.prompt()
      if ((await install.userChoice).outcome === 'accepted') {
        void retainInstalledStorage()
        setNotice('Atlas is ready for your home screen.')
      }
      setInstall(null)
    } else setDialog('install')
  }

  const clearFilters = () => {
    setQuery('')
    setGen(0)
    setType('')
    setFormKind('')
    setSavedOnly(false)
    setLimit(40)
  }

  return (
    <div className="app-shell" data-locale={locale} data-catalog-state={catalogStatus}>
      <button
        className="skip-link"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        {t('Skip to viewer')}{' '}
      </button>
      <header className="header">
        <a className="brand" href={uiHref({ kind: 'home' }, locale)} aria-label={t('Pokémon Atlas home')}>
          <img src={assetPath('/icon.svg')} alt="" width="38" height="38" />
          <span>
            pokémon<span className="brand-light">atlas</span>
            <sup>3D</sup>
          </span>
        </a>
        <nav aria-label={t('Main navigation')}>
          <a className={!savedOnly ? 'nav-active' : ''} href={atlasPath({ kind: 'catalog' }, locale)}>
            {t('Explore')}
          </a>
          <button
            className={savedOnly ? 'nav-active' : ''}
            onClick={() => {
              setSavedOnly(true)
              setLimit(40)
              setMobileCollection(true)
            }}
          >
            {t('Collection')} <span className="count">{fmt(favorites.size)}</span>
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="language-button"
            aria-label={t('Choose your language')}
            title={localeName(locale)}
            onClick={() => {
              setLanguageQuery('')
              setDialog('language')
            }}
          >
            <Languages size={18} />
            <bdi>{locale.toUpperCase()}</bdi>
          </button>
          <button className="icon-button" aria-label={t('How to explore')} onClick={() => setDialog('help')}>
            <CircleHelp size={19} />
          </button>
          <button className="install-button" onClick={installApp}>
            <ArrowDownToLine size={16} />
            <span>{t('Get the app')} </span>
            <ArrowUpRight size={15} />
          </button>
        </div>
      </header>

      {offline && (
        <div className="offline-notice" role="status">
          {t('You’re offline. Recently viewed Pokémon may still be available.')}{' '}
        </div>
      )}
      {needRefresh && (
        <div className="offline-notice">
          {t('A fresh version of Atlas is ready.')}{' '}
          <button onClick={applyAppUpdate}>{t('Update now')} </button>
        </div>
      )}

      <div className="workspace">
        <aside
          className={`collection-panel ${mobileCollection ? 'mobile-open' : ''}`}
          aria-label={t('Pokémon collection')}
        >
          <div className="collection-heading">
            <div>
              <h2>{t('Collection')}</h2>
            </div>
            <button
              className="icon-button close-collection"
              aria-label={t('Close collection')}
              onClick={() => setMobileCollection(false)}
            >
              <X size={20} />
            </button>
          </div>
          <label className="search-box">
            <Search size={17} />
            <input
              ref={search}
              type="search"
              placeholder={t('Name or number…')}
              aria-label={t('Search Pokémon by name or number')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(40)
              }}
            />
            <kbd>/</kbd>
          </label>
          <div className="filter-row">
            <label>
              <span className="sr-only">{t('Generation')} </span>
              <select
                aria-label={t('Generation')}
                value={gen}
                onChange={(e) => {
                  setGen(Number(e.target.value))
                  setLimit(40)
                }}
              >
                {generations.map((generation, i) => (
                  <option key={generation} value={i}>
                    {generationName(i)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <label>
              <span className="sr-only">{t('Type')} </span>
              <select
                aria-label={t('Type')}
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  setLimit(40)
                }}
              >
                <option value="">{t('All types')} </option>
                {Object.keys(typeColors).map((t) => (
                  <option key={t} value={t}>
                    {typeName(t)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
          <label className="form-filter">
            <span className="sr-only">{t('Forms')}</span>
            <select
              aria-label={t('Forms')}
              value={formKind}
              onChange={(event) => {
                setFormKind(event.target.value)
                setLimit(40)
              }}
            >
              <option value="">{t('All Pokémon')}</option>
              <option value="mega">{t('Mega Evolution')}</option>
              <option value="regional">{t('Regional forms')}</option>
            </select>
          </label>
          <div className="result-count">
            <span>{t('{count} Pokémon', { count: fmt(filtered.length) })}</span>
            {(query || type || formKind || gen !== 0) && (
              <button onClick={clearFilters}>{t('Reset filters')} </button>
            )}
            <Layers3 size={14} />
          </div>
          <div ref={collection} className="collection-scroll">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <Compass size={30} />
                <h3>{t('No Pokémon found.')}</h3>
                <p>
                  {savedOnly
                    ? t('Tap the heart beside a Pokémon to keep it here.')
                    : t('Try another name, number, generation, or type.')}
                </p>
                <button className="text-button" onClick={clearFilters}>
                  {t('Explore all Pokémon')} <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <>
                <div className="pokemon-grid">
                  {filtered.slice(0, limit).map((p) => (
                    <PokemonCard
                      key={p.id}
                      entry={p}
                      active={p.id === selected.id}
                      saved={favorites.has(p.id)}
                      onSelect={() => choose(p)}
                      formId={formChoice(p)?.id}
                    />
                  ))}
                </div>
                {limit < filtered.length && (
                  <button className="load-more" onClick={() => setLimit((l) => l + 40)}>
                    {t('Discover more')} <ArrowDownToLine size={15} />
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        <main
          id="main"
          tabIndex={-1}
          className="main-panel"
          inert={mobileCollection && matchMedia('(max-width: 700px)').matches}
        >
          <nav className="atlas-breadcrumbs" aria-label={seoWords(locale).catalog}>
            {pageSeo.breadcrumbs.map((crumb, index) => (
              <span key={crumb.href}>
                {index > 0 && <span aria-hidden="true"> / </span>}
                <a
                  href={crumb.href}
                  aria-current={index === pageSeo.breadcrumbs.length - 1 ? 'page' : undefined}
                >
                  {crumb.name}
                </a>
              </span>
            ))}
          </nav>
          {page.kind === 'home' && <h1 className="atlas-home-title">{seoWords(locale).home}</h1>}
          <div className="mobile-toolbar">
            <button
              onClick={() => {
                setSavedOnly(false)
                setMobileCollection(true)
              }}
            >
              <Search size={16} />
              {t('Browse {count} Pokémon', { count: fmt(pokemon.length) })}
            </button>
            <button
              aria-label={t('Pokémon details and studio settings')}
              onClick={() => {
                setTab('overview')
                document.getElementById('overview')?.scrollIntoView({ block: 'start' })
              }}
            >
              {t('Overview')}
            </button>
          </div>
          <div className="specimen-heading">
            <div>
              <div className="eyebrow">
                {together ? (
                  t('Together')
                ) : (
                  <>
                    <span className="catalog-number"># {String(selected.id).padStart(4, '0')}</span>
                    <span className="tiny-dot" />
                    {generationName(selected.gen)}
                  </>
                )}
              </div>
              {page.kind === 'home' ? (
                <h2>{together ? t('Your scene') : <bdi lang={details.nameLang}>{details.name}</bdi>}</h2>
              ) : (
                <h1>
                  <bdi lang={details.nameLang}>{details.name}</bdi>
                </h1>
              )}
              <div className="type-row">
                {together ? (
                  <span className="genus">
                    {t('{count} Pokémon', { count: fmt(studioState.draft?.members.length || 0) })}
                  </span>
                ) : (
                  <>
                    {displayed.types.map((t) => (
                      <TypePill key={t} type={t} />
                    ))}
                    <span className="genus" lang={details.genusLang} dir="auto">
                      {details.genus}
                    </span>
                  </>
                )}
              </div>
            </div>
            {!together && (
              <button
                className={`save-button ${favorites.has(selected.id) ? 'is-saved' : ''}`}
                aria-label={
                  favorites.has(selected.id)
                    ? t('Remove {name} from collection', { name: details.name })
                    : t('Save {name}', { name: details.name })
                }
                aria-pressed={favorites.has(selected.id)}
                onClick={toggleFavorite}
              >
                <Heart size={20} fill={favorites.has(selected.id) ? 'currentColor' : 'none'} />
                <span>{favorites.has(selected.id) ? t('Saved') : t('Save')}</span>
              </button>
            )}
          </div>

          {!together && <FormSelect speciesId={selected.id} value={formId} onChange={chooseForm} />}
          <fieldset className="scene-mode" aria-label={t('Your scene')}>
            <button
              aria-pressed={!together}
              onClick={() => {
                leaveTogether()
              }}
            >
              {t('Solo view')}
            </button>
            <button aria-pressed={together} onClick={enterTogether}>
              {t('Together')}
            </button>
          </fieldset>
          <section
            id="viewer"
            ref={studio}
            className={`viewer-stage ${settings.habitat} ${together ? 'together' : ''} ${focus ? 'focus-view' : ''}`}
            aria-label={
              together ? t('Your scene') : t('{name} interactive 3D studio', { name: details.name })
            }
          >
            {!together && loading && (
              <img
                className="model-loading-preview"
                src={previewImage(selected.id, activeForm?.id)}
                alt={details.name}
                width="480"
                height="480"
                fetchPriority="high"
              />
            )}
            <div className="stage-watermark" aria-hidden="true">
              {together ? '' : String(selected.id).padStart(3, '0')}
            </div>
            <div className="stage-top">
              <span className="live-label">
                <span className={`live-dot ${loading ? 'loading' : ''}`} />
                {loading ? t('Opening model') : error ? t('Preview unavailable') : t('LIVE VIEW')}
              </span>
              <button
                className="stage-button"
                aria-label={focus ? t('Exit focused view') : t('Expand viewer')}
                onClick={() => setFocus((f) => !f)}
              >
                {focus ? <X size={17} /> : <Expand size={17} />}
              </button>
            </div>
            <Suspense
              fallback={
                <div className="loader">
                  <LoaderCircle className="spin" size={27} />
                  <span>{t('Opening model')} </span>
                </div>
              }
            >
              <Viewer
                key={reload}
                ref={viewer}
                pokemon={displayed}
                backgroundUrl={backgroundUrl}
                onBackgroundError={() => {
                  setNotice('The background could not be opened.')
                  setBackgroundFailed(true)
                }}
                model={model}
                label={t('{name} interactive 3D studio', {
                  name:
                    together && studioState.draft
                      ? studioState.draft.members
                          .map((member) => {
                            const entry = pokemon.find((p) => p.id === member.speciesId)
                            return entry ? species(entry).name : ''
                          })
                          .join(', ')
                      : details.name,
                })}
                settings={
                  backgroundFailed && settings.habitat === 'custom'
                    ? { ...settings, habitat: 'studio' }
                    : settings
                }
                members={together ? studioState.draft?.members : undefined}
                onCameraChange={(camera) => {
                  if (together && !loading)
                    setStudioState((state) => ({
                      ...state,
                      draft: state.draft ? { ...state.draft, camera } : null,
                    }))
                }}
                onLoad={(names) => {
                  setAnimations(names)
                  setError('')
                }}
                onError={(message) => {
                  setAnimations([])
                  setError(message)
                  setLoading(false)
                }}
                onLoading={(value) => {
                  setLoading(value)
                  if (value) setError('')
                  else {
                    if (pendingCamera.current) {
                      viewer.current?.restoreCamera(pendingCamera.current)
                      pendingCamera.current = undefined
                    }
                    if (together) {
                      const camera = viewer.current?.getCamera()
                      if (camera)
                        setStudioState((state) => ({
                          ...state,
                          draft: state.draft ? { ...state.draft, camera } : null,
                        }))
                    }
                  }
                }}
              />
            </Suspense>
            {loading && (
              <div className="loader">
                <LoaderCircle className="spin" size={28} />
                <span>{t('Opening model')}</span>
              </div>
            )}
            {error && (
              <div className="viewer-error">
                <Orbit size={34} />
                <p>{t(error)}</p>
                <button
                  className="primary-button"
                  onClick={() => {
                    setError('')
                    setLoading(true)
                    setReload((n) => n + 1)
                  }}
                >
                  {t('Try again')} <RotateCcw size={15} />
                </button>
              </div>
            )}
            <div className="view-tools">
              <button aria-label={t('Zoom in')} onClick={() => viewer.current?.zoom(1)}>
                <ZoomIn size={18} />
              </button>
              <button aria-label={t('Zoom out')} onClick={() => viewer.current?.zoom(-1)}>
                <ZoomOut size={18} />
              </button>
              <span />
              <button aria-label={t('Reset camera')} onClick={() => viewer.current?.view('reset')}>
                <RotateCcw size={17} />
              </button>
              <button
                aria-label={t('Save studio image')}
                disabled={loading || !!error}
                onClick={async () => {
                  try {
                    await viewer.current?.capture()
                    setNotice('Your studio image is ready.')
                  } catch {
                    setNotice('The image could not be saved. Please try again.')
                  }
                }}
              >
                <ArrowDownToLine size={17} />
              </button>
            </div>
            <fieldset className="angle-controls" aria-label={t('Camera angles')}>
              {(['front', 'side', 'back', 'top'] as const).map((angle) => (
                <button key={angle} onClick={() => viewer.current?.view(angle)}>
                  {t(angle)}
                </button>
              ))}
            </fieldset>
            <div className="stage-hint">
              <Orbit size={13} />
              {t('Drag to orbit')} <span>·</span>
              {t('Scroll to zoom')}{' '}
            </div>
          </section>

          <div className="playback-bar">
            <div className="playback-main">
              <button
                className="play-button"
                aria-label={settings.playing ? t('Pause animation') : t('Play animation')}
                aria-pressed={settings.playing}
                disabled={loading || !!error}
                onClick={() => update({ playing: !settings.playing })}
              >
                {settings.playing ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
              </button>
              <div>
                <span className="control-heading">
                  {error
                    ? t('Motion unavailable')
                    : loading
                      ? t('Opening model')
                      : !settings.playing
                        ? t('Play animation')
                        : animations.length
                          ? t('In motion')
                          : t('Gentle motion')}
                </span>
                <span className="control-caption">
                  {error
                    ? t('Load a 3D model to play')
                    : loading
                      ? t('Preparing your view')
                      : animations.length
                        ? t('Character animation')
                        : t('Subtle display movement')}
                </span>
              </div>
            </div>
            <div className="playback-divider" />
            <label className="speed-control">
              <span>{t('Speed')} </span>
              <input
                type="range"
                aria-label={t('Animation speed')}
                disabled={loading || !!error}
                min="0.25"
                max="2"
                step="0.25"
                value={settings.speed}
                onChange={(e) => update({ speed: Number(e.target.value) })}
              />
              <output>{fmt(settings.speed, { maximumFractionDigits: 2 })}×</output>
            </label>
            <button
              className={`auto-orbit ${settings.rotate ? 'active' : ''}`}
              aria-pressed={settings.rotate}
              disabled={loading || !!error}
              onClick={() => update({ rotate: !settings.rotate })}
            >
              <RotateCcw size={15} />
              <span>{t('Auto orbit')} </span>
              <i />
            </button>
          </div>

          <section className="environment-section" aria-labelledby="environment-title">
            <div className="section-label">
              <h2 id="environment-title">{t('Environment')}</h2>
            </div>
            <div className="environments">
              {habitats
                .filter((key) => key !== 'custom' || !!settings.backgroundId)
                .map((key) => (
                  <button
                    key={key}
                    className={`environment-card ${key} ${settings.habitat === key ? 'active' : ''}`}
                    aria-pressed={settings.habitat === key}
                    onClick={() => update({ habitat: key })}
                  >
                    <span className="environment-art" aria-hidden="true" />
                    <strong>{t(habitatNames[key])}</strong>
                    {settings.habitat === key && <Check size={14} className="scene-check" />}
                  </button>
                ))}
            </div>
            {backgroundFailed && settings.habitat === 'custom' && (
              <p className="catalog-notice" role="status">
                {t('The background could not be opened.')}{' '}
                <button className="text-button" onClick={() => setBackgroundAttempt((value) => value + 1)}>
                  {t('Try again')}
                </button>
              </p>
            )}
            <BackgroundPicker
              selected={!!settings.backgroundId}
              onError={setNotice}
              onSelect={(id) => {
                update({ backgroundId: id, habitat: 'custom' })
                try {
                  localStorage.setItem('atlas-background', id)
                } catch {
                  /* The scene still holds the reference. */
                }
              }}
              onRemove={() => {
                update({
                  backgroundId: undefined,
                  habitat: settings.habitat === 'custom' ? 'studio' : settings.habitat,
                })
                try {
                  localStorage.removeItem('atlas-background')
                } catch {
                  /* Optional preference. */
                }
              }}
            />
          </section>
          {together && studioState.draft && (
            <SceneEditor
              members={studioState.draft.members}
              onChange={(members) =>
                setStudioState((state) => ({
                  ...state,
                  draft: state.draft ? { ...state.draft, members } : null,
                }))
              }
              name={studioState.draft.name}
              onNameChange={(name) =>
                setStudioState((state) => ({
                  ...state,
                  draft: state.draft ? { ...state.draft, name } : null,
                }))
              }
              saved={studioState.saved}
              onSave={saveScene}
              onOpen={openScene}
              onDelete={(id) =>
                setStudioState((state) => ({
                  ...state,
                  saved: state.saved.filter((scene) => scene.id !== id),
                }))
              }
              onDownload={downloadScene}
              onImport={importScene}
              storageFailed={storageFailed}
            />
          )}
          <div className="specimen-navigation">
            <a
              href={uiHref({ kind: 'pokemon', id: neighbor(-1).id }, locale)}
              onClick={(event) => follow(event, () => move(-1))}
            >
              <ArrowLeft size={16} />
              {t('Previous')}{' '}
            </a>
            <span>
              {index >= 0 ? String(index + 1).padStart(3, '0') : '—'} <i>/</i> {fmt(filtered.length)}
            </span>
            <a
              href={uiHref({ kind: 'pokemon', id: neighbor(1).id }, locale)}
              onClick={(event) => follow(event, () => move(1))}
            >
              {t('Next')} <ArrowRight size={16} />
            </a>
          </div>
        </main>

        <aside
          id="overview"
          className="detail-panel"
          aria-label={t('Pokémon details and studio settings')}
          inert={mobileCollection && matchMedia('(max-width: 700px)').matches}
        >
          <div className="detail-tabs">
            <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
              {t('Overview')}{' '}
            </button>
            <button className={tab === 'studio' ? 'active' : ''} onClick={() => setTab('studio')}>
              <SlidersHorizontal size={14} />
              {t('Studio')}{' '}
            </button>
          </div>
          {tab === 'overview' ? (
            <div className="detail-content">
              {catalogStatus === 'loading' && (
                <p className="catalog-notice" role="status">
                  {t('Loading translated entries…')}
                </p>
              )}
              {catalogStatus === 'failed' && (
                <div className="catalog-notice" role="status">
                  <p>
                    {t(
                      offline
                        ? 'Translated entries are unavailable offline. English entries are ready to explore.'
                        : 'Translated entries could not be loaded. English entries are ready to explore.',
                    )}
                  </p>
                  <button className="text-button" onClick={retryCatalog}>
                    {t('Retry translations')}
                  </button>
                </div>
              )}
              {locale !== 'en' && details.descriptionLang === 'en' && (
                <span className="entry-language" title={t('This entry is available in English.')}>
                  {t('English entry')}
                </span>
              )}
              {activeForm && (
                <p className="entry-source">
                  {baseDetails.name} · {t('Standard form')}
                </p>
              )}
              <img
                className="species-reference"
                src={previewImage(selected.id, activeForm?.id)}
                alt={details.name}
                width="120"
                height="120"
                loading="lazy"
              />
              <p className="description" lang={details.descriptionLang} dir="auto">
                {details.description}
              </p>
              {details.sourceURL && (
                <p className="entry-source">
                  <a href={details.sourceURL} target="_blank" rel="noreferrer">
                    {t('Source')}: {details.sourceLabel || 'PokéAPI'}
                  </a>
                  {details.verifiedAt && <time dateTime={details.verifiedAt}> · {details.verifiedAt}</time>}
                </p>
              )}
              {formsFor(selected.id).length > 0 && (
                <details className="available-forms">
                  <summary>{t('Form')}</summary>
                  <ul>
                    <li>
                      <a
                        href={uiHref({ kind: 'pokemon', id: selected.id }, locale)}
                        onClick={(event) => follow(event, () => chooseForm(''))}
                      >
                        {t('Standard form')}
                      </a>
                    </li>
                    {formsFor(selected.id).map((form) => (
                      <li key={form.id}>
                        <a
                          href={uiHref({ kind: 'pokemon', id: selected.id, formId: form.id }, locale)}
                          onClick={(event) => follow(event, () => chooseForm(form.id))}
                        >
                          {form.names[locale] || form.name}
                        </a>
                        {form.model.shiny && <small> · {t('Shiny appearance')}</small>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="measurements">
                <div>
                  <span>{t('HEIGHT')} </span>
                  <strong>
                    {fmt(displayed.height)}
                    <small>m</small>
                  </strong>
                </div>
                <div>
                  <span>{t('WEIGHT')} </span>
                  <strong>
                    {fmt(displayed.weight)}
                    <small>kg</small>
                  </strong>
                </div>
              </div>
              <section className="stats">
                <div className="section-label">
                  <h3>{t('Base stats')} </h3>
                  <span>
                    {t('TOTAL {number}', { number: fmt(displayed.stats.reduce((a, b) => a + b, 0)) })}
                  </span>
                </div>
                {[t('HP'), t('Attack'), t('Defense'), t('Sp. Atk'), t('Sp. Def'), t('Speed stat')].map(
                  (name, i) => (
                    <div className="stat-row" key={name}>
                      <span>{name}</span>
                      <div className="stat-track">
                        <i style={{ width: `${(displayed.stats[i] / 255) * 100}%` }} />
                      </div>
                      <strong>{fmt(displayed.stats[i])}</strong>
                    </div>
                  ),
                )}
              </section>
              {evolution.length > 0 && (
                <section className="evolution-section">
                  <div className="section-label">
                    <h3>{t('Connected by evolution')} </h3>
                  </div>
                  {evolution.map((p) => (
                    <a
                      href={uiHref({ kind: 'pokemon', id: p.id }, locale)}
                      key={p.id}
                      className="evolution-card"
                      onClick={(event) => follow(event, () => choose(p))}
                    >
                      <img src={art(p.id)} alt="" width="48" height="48" loading="lazy" />
                      <span>
                        <small>{p.id === selected.evolvesFrom ? t('EVOLVES FROM') : t('EVOLVES INTO')}</small>
                        <strong>
                          <bdi lang={species(p).nameLang}>{species(p).name}</bdi>
                        </strong>
                      </span>
                      <ArrowUpRight size={16} />
                    </a>
                  ))}
                </section>
              )}
            </div>
          ) : (
            <div className="detail-content studio-settings">
              <label className="setting">
                <span>
                  {t('Lighting')}{' '}
                  <output>{fmt(settings.light, { style: 'percent', maximumFractionDigits: 0 })}</output>
                </span>
                <input
                  aria-label={t('Lighting')}
                  type="range"
                  min="0.5"
                  max="1.8"
                  step="0.1"
                  value={settings.light}
                  onChange={(e) => update({ light: Number(e.target.value) })}
                />
              </label>
              <label className="setting">
                <span>{t('Render quality')} </span>
                <select
                  aria-label={t('Render quality')}
                  value={settings.quality}
                  onChange={(e) => update({ quality: e.target.value as ViewerSettings['quality'] })}
                >
                  <option value="high">{t('High detail')} </option>
                  <option value="standard">{t('Battery friendly')} </option>
                </select>
              </label>
              {animations.length > 0 && !loading && !error && (
                <label className="setting">
                  <span>{t('Animation')} </span>
                  <select
                    aria-label={t('Animation')}
                    value={settings.animation}
                    onChange={(e) => update({ animation: Number(e.target.value) })}
                  >
                    {animations.map((name, i) => (
                      <option key={name} value={i}>
                        {t('Motion {number}', { number: fmt(i + 1) })}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!animations.length && !loading && !error && (
                <p className="setting-note">
                  {t(
                    'This model has no recorded character animation. Gentle motion adds a subtle display movement.',
                  )}{' '}
                </p>
              )}
              <button
                className={`toggle-setting ${settings.wireframe ? 'on' : ''}`}
                aria-pressed={settings.wireframe}
                onClick={() => update({ wireframe: !settings.wireframe })}
              >
                <span>
                  <Layers3 size={17} />
                  {t('Explore the geometry')}{' '}
                </span>
                <i />
              </button>
              {!together && (
                <button
                  className={`toggle-setting ${settings.shiny ? 'on' : ''}`}
                  aria-pressed={settings.shiny}
                  disabled={!model?.shiny}
                  onClick={() => update({ shiny: !settings.shiny, animation: 0 })}
                >
                  <span>
                    <Sparkles size={17} />
                    {t('Shiny appearance')}{' '}
                  </span>
                  <i />
                </button>
              )}
              {!together && !model?.shiny && (
                <p className="setting-note">{t('A shiny model isn’t available for this Pokémon.')} </p>
              )}
              <button
                className="reset-settings"
                onClick={() => {
                  setSettings(defaultSettings)
                  viewer.current?.view('reset')
                }}
              >
                <RotateCcw size={15} />
                {t('Reset studio')}{' '}
              </button>
            </div>
          )}
          <div className="detail-bottom">
            <button className="share-button" onClick={share}>
              <Share2 size={15} />
              {t('Share link')} <ArrowUpRight size={15} />
            </button>
            <button className="about-link" onClick={() => setDialog('about')}>
              {t('About Atlas & credits')}{' '}
            </button>
          </div>
        </aside>
      </div>

      <AdSlot
        client={AD_CLIENT}
        slot={AD_SLOT}
        enabled={advertising.enabled}
        scriptReady={advertising.scriptReady}
        scriptFailed={advertising.scriptFailed}
        label={t('Advertisement')}
      />
      <footer className="footer">
        <a href={atlasPath({ kind: 'catalog' }, locale)}>{t('Pokémon collection')}</a>
        <a href={atlasPath({ kind: 'forms' }, locale)}>{t('Form')}</a>
        <a href={atlasPath({ kind: 'help' }, locale)}>{t('How to explore')}</a>
        <a href={atlasPath({ kind: 'about' }, locale)}>{t('Contact')}</a>
        <span>{t('An independent Pokémon fan experience.')} </span>
        <a href={`/atlas/legal/${locale === 'ja' ? 'ja' : 'en'}/terms.html`}>{t('Terms of use')}</a>
        <a href={`/atlas/legal/${locale === 'ja' ? 'ja' : 'en'}/privacy.html`}>{t('Privacy policy')}</a>
        <button onClick={() => setDialog('about')}>
          {t('Credits')} <ArrowUpRight size={12} />
        </button>
        {advertising.canReopenConsent && (
          <button type="button" onClick={advertising.reopenConsent}>
            {t('Ad privacy choices')}
          </button>
        )}
        {advertising.canOpenUsChoices && (
          <button type="button" onClick={advertising.openUsChoices}>
            {t('Do not sell or share my personal information')}
          </button>
        )}
      </footer>
      <Privacy pageId={selected.id} formId={formId} locale={locale} />
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {t(notice)}
        </div>
      )}
      <dialog
        ref={modal}
        aria-label={t(
          dialog === 'language'
            ? 'Choose your language'
            : dialog === 'help'
              ? 'How to explore'
              : dialog === 'install'
                ? 'Get the app'
                : 'About Atlas & credits',
        )}
        className="dialog"
        onCancel={() => setDialog(null)}
        onClose={() => setDialog(null)}
      >
        <button
          className="dialog-close icon-button"
          aria-label={t('Close dialog')}
          onClick={() => setDialog(null)}
        >
          <X size={21} />
        </button>
        {dialog === 'language' && (
          <div className="language-dialog">
            <span className="eyebrow">{t('Language')}</span>
            <h2>{t('Choose your language')}</h2>
            <label className="search-box">
              <Search size={17} />
              <input
                ref={languageSearch}
                type="search"
                aria-label={t('Search languages')}
                placeholder={t('Search languages')}
                value={languageQuery}
                onChange={(event) => setLanguageQuery(event.target.value)}
              />
            </label>
            <div className="language-options">
              {locales
                .filter(([code, native, english]) =>
                  normalizeSearch(`${code} ${native} ${english} ${localeName(code)}`).includes(
                    normalizeSearch(languageQuery),
                  ),
                )
                .map(([code, native]) => (
                  <a
                    href={uiHref(page, code)}
                    key={code}
                    data-language={code}
                    className={`language-choice ${code === locale ? 'selected' : ''}`}
                    aria-current={code === locale ? 'true' : undefined}
                    aria-disabled={languageStatus === 'loading'}
                    onClick={(event) =>
                      follow(event, () => {
                        if (languageStatus === 'loading') return
                        void chooseLocale(code).then((success) => {
                          if (success) setDialog(null)
                        })
                      })
                    }
                  >
                    <span>
                      <bdi lang={code}>{native}</bdi>
                      <small>{localeName(code)}</small>
                    </span>
                    {code === locale && <Check size={18} />}
                  </a>
                ))}
              {!locales.some(([code, native, english]) =>
                normalizeSearch(`${code} ${native} ${english} ${localeName(code)}`).includes(
                  normalizeSearch(languageQuery),
                ),
              ) && <p role="status">{t('No languages found.')}</p>}
            </div>
            {languageStatus === 'loading' && <p role="status">{t('Loading language…')}</p>}
            {languageStatus === 'failed' && (
              <p role="status">
                {t('The language could not be loaded. Try again.')}{' '}
                <button
                  onClick={() => {
                    void retryLanguage().then((success) => {
                      if (success) setDialog(null)
                    })
                  }}
                >
                  {t('Retry translations')}
                </button>
              </p>
            )}
            {preferenceSaved && <p className="setting-note">{t('Your language is saved on this device.')}</p>}
          </div>
        )}
        {dialog === 'help' && (
          <>
            <h2>{t('How to explore')}</h2>
            <p>
              <a href={atlasPath({ kind: 'help' }, locale)}>
                {seoWords(locale).help} <ArrowUpRight size={14} />
              </a>
            </p>
            <div className="guide-list">
              <div>
                <Orbit />
                <span>
                  {t(
                    'Drag to rotate, scroll or pinch to zoom. Use Front, Side, Back, and Top for a new perspective.',
                  )}{' '}
                </span>
              </div>
              <div>
                <Play />
                <span>{t('Play or pause motion, change its speed, and turn on auto orbit.')} </span>
              </div>
              <div>
                <Sun />
                <span>{t('Choose a scene, adjust the light in Studio, and save an image.')} </span>
              </div>
              <div>
                <Heart />
                <span>{t('Tap Save to add a Pokémon to your collection on this device.')} </span>
              </div>
            </div>
            <p className="shortcut-note">
              {t('Keyboard: ← / → previous / next · Space play / pause · / search · Esc close')}{' '}
            </p>
          </>
        )}
        {dialog === 'about' && (
          <>
            <h2>{t('About Atlas & credits')}</h2>
            <p>
              {t(
                'Pokémon and Pokémon character names belong to Nintendo, Creatures Inc., and GAME FREAK inc. Atlas is not affiliated with or endorsed by them.',
              )}{' '}
            </p>
            <p>
              {t('Species data and artwork')}:
              <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">
                PokéAPI
              </a>
              · {t('3D models')}:
              <a href="https://github.com/Pokemon-3D-api/assets" target="_blank" rel="noreferrer">
                Pokémon 3D API
              </a>{' '}
              ·
              <a
                href="https://github.com/Lilothestitch16/Pokemon-HOME-GLB-Models"
                target="_blank"
                rel="noreferrer"
              >
                Lilothestitch16 · Pokémon HOME
              </a>
            </p>
            <p>
              {t(
                'Model detail and recorded animations vary by species. The collection covers the 1,025 numbered species; alternate forms are not all included.',
              )}{' '}
            </p>
            <p className="legal-links">
              <a href={`/atlas/legal/${locale === 'ja' ? 'ja' : 'en'}/rights.html`}>
                {t('Rights & credits')}
              </a>
              <a href={`/atlas/legal/${locale === 'ja' ? 'ja' : 'en'}/terms.html`}>{t('Terms of use')}</a>
              <a href={`/atlas/legal/${locale === 'ja' ? 'ja' : 'en'}/privacy.html`}>{t('Privacy policy')}</a>
              <a href="https://github.com/rrih/rrih.github.io/issues">{t('Contact')}</a>
            </p>
          </>
        )}
        {dialog === 'install' && (
          <>
            <h2>{t('Get the app')}</h2>
            <p>{t('Install Atlas to open it like an app, with more room to explore.')} </p>
            <div className="install-guide">
              <strong>{t('iPhone & iPad')} </strong>
              <p>{t('Open in Safari, tap Share, then Add to Home Screen.')} </p>
              <strong>{t('Android & desktop')} </strong>
              <p>
                {t(
                  'Open the browser menu and choose Install app or Add to Home screen. If Atlas is already installed, open it from your home screen or apps.',
                )}{' '}
              </p>
            </div>
            <p className="setting-note">
              {t(
                'Your collection is stored on this device. New models require a connection; recently viewed models can remain available offline.',
              )}{' '}
            </p>
          </>
        )}
      </dialog>
    </div>
  )
}
