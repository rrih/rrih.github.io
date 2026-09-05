import { useRegisterSW } from 'virtual:pwa-register/react'
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
  Leaf,
  LoaderCircle,
  Moon,
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
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { cacheOpenedView, retainInstalledStorage } from './cache'
import { art, filterPokemon, generations, models, pokemon, readFavorites, typeColors } from './catalog'
import { useLocale } from './i18n'
import { isRTL, locales, normalizeSearch } from './locales'
import type { Pokemon, ViewerHandle, ViewerSettings } from './types'

const Viewer = lazy(() => import('./Viewer'))
const initialHash = () => new URLSearchParams(location.hash.slice(1))
const initialId = () => Number(initialHash().get('pokemon')) || 6
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

function TypePill({ type }: { type: string }) {
  const { typeName } = useLocale()
  return (
    <span className="type-pill" style={{ color: typeColors[type], borderColor: `${typeColors[type]}40` }}>
      <i style={{ background: typeColors[type] }} />
      {typeName(type)}
    </span>
  )
}

function PokemonCard({
  entry,
  active,
  saved,
  onSelect,
}: {
  entry: Pokemon
  active: boolean
  saved: boolean
  onSelect: () => void
}) {
  const { t, species } = useLocale()
  const localized = species(entry)
  return (
    <button
      className={`pokemon-card ${active ? 'selected' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
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
    </button>
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
  } = useLocale()
  const generationName = (index: number) =>
    index
      ? t('Generation {number}', {
          number: locale === 'en' ? generations[index].replace('Generation ', '') : fmt(index),
        })
      : t('All generations')
  const [languageQuery, setLanguageQuery] = useState('')
  const [selected, setSelected] = useState(() => pokemon.find((p) => p.id === initialId()) || pokemon[5])
  const [query, setQuery] = useState('')
  const [gen, setGen] = useState(0)
  const [type, setType] = useState('')
  const [favorites, setFavorites] = useState(readFavorites)
  const [savedOnly, setSavedOnly] = useState(false)
  const [limit, setLimit] = useState(40)
  const [settings, setSettings] = useState<ViewerSettings>(() => ({
    ...defaultSettings,
    habitat: ['studio', 'forest', 'night'].includes(initialHash().get('scene') || '')
      ? (initialHash().get('scene') as ViewerSettings['habitat'])
      : 'studio',
    shiny: initialHash().get('shiny') === '1' && !!models[String(initialId())]?.shiny,
  }))
  const [animations, setAnimations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [tab, setTab] = useState<'overview' | 'studio'>('overview')
  const [dialog, setDialog] = useState<'help' | 'about' | 'install' | 'language' | null>(null)
  const [notice, setNotice] = useState('')
  const [install, setInstall] = useState<InstallPrompt | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [mobileCollection, setMobileCollection] = useState(false)
  const [focus, setFocus] = useState(false)
  const stateRef = useRef({ id: selected.id, settings })
  stateRef.current = { id: selected.id, settings }
  const viewer = useRef<ViewerHandle>(null)
  const studio = useRef<HTMLElement>(null)
  const modal = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const collection = useRef<HTMLDivElement>(null)
  const languageSearch = useRef<HTMLInputElement>(null)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const filtered = useMemo(
    () => filterPokemon(query, gen, type, savedOnly ? favorites : null),
    [query, gen, type, savedOnly, favorites],
  )
  const evolution = useMemo(
    () => pokemon.filter((p) => p.evolvesFrom === selected.id || p.id === selected.evolvesFrom),
    [selected],
  )
  const details = species(selected)
  const model = models[String(selected.id)]
  const index = filtered.findIndex((p) => p.id === selected.id)
  const modelUrl = settings.shiny && model?.shiny ? model.shiny : model?.url

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const controlled = () => void cacheOpenedView(modelUrl)
    navigator.serviceWorker.addEventListener('controllerchange', controlled)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', controlled)
  }, [modelUrl])

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

  const update = (patch: Partial<ViewerSettings>) => setSettings((s) => ({ ...s, ...patch }))

  function choose(entry: Pokemon) {
    if (entry.id === selected.id) {
      setMobileCollection(false)
      return
    }
    setSelected(entry)
    setAnimations([])
    setError('')
    setLoading(true)
    update({ shiny: false, animation: 0 })
    setMobileCollection(false)
  }

  function move(direction: number) {
    const entries = filtered.length ? filtered : pokemon
    const current = entries.findIndex((p) => p.id === selected.id)
    choose(
      entries[
        current < 0
          ? direction > 0
            ? 0
            : entries.length - 1
          : (current + direction + entries.length) % entries.length
      ],
    )
  }

  useEffect(() => {
    const hash = new URLSearchParams({ pokemon: String(selected.id), scene: settings.habitat })
    if (settings.shiny) hash.set('shiny', '1')
    history.replaceState(null, '', `#${hash}`)
    document.title = `${details.name} — Pokémon Atlas`
  }, [selected, details.name, settings.habitat, settings.shiny])

  useEffect(() => {
    const change = () => {
      const hash = initialHash()
      if (!hash.has('pokemon')) return
      const entry = pokemon.find((p) => p.id === Number(hash.get('pokemon')))
      if (!entry) return
      const current = stateRef.current
      const habitat = ['studio', 'forest', 'night'].includes(hash.get('scene') || '')
        ? (hash.get('scene') as ViewerSettings['habitat'])
        : 'studio'
      const shiny = hash.get('shiny') === '1' && !!models[entry.id]?.shiny
      const changed = current.id !== entry.id || current.settings.shiny !== shiny
      setSelected(entry)
      setSettings((s) => ({ ...s, habitat, shiny, animation: changed ? 0 : s.animation }))
      if (changed) {
        setError('')
        setAnimations([])
        setLoading(true)
      }
    }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
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
      await navigator.clipboard.writeText(location.href)
      setNotice('Link copied. Share this discovery.')
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
        <button className="brand" onClick={() => choose(pokemon[5])} aria-label={t('Pokémon Atlas home')}>
          <img src="/icon.svg" alt="" width="38" height="38" />
          <span>
            pokémon<span className="brand-light">atlas</span>
            <sup>3D</sup>
          </span>
        </button>
        <nav aria-label={t('Main navigation')}>
          <button
            className={!savedOnly ? 'nav-active' : ''}
            onClick={() => {
              setSavedOnly(false)
              setLimit(40)
            }}
          >
            {t('Explore')}{' '}
          </button>
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
          <button onClick={() => updateServiceWorker(true)}>{t('Update now')} </button>
        </div>
      )}

      <div className="workspace">
        <aside
          className={`collection-panel ${mobileCollection ? 'mobile-open' : ''}`}
          aria-label={t('Pokémon collection')}
        >
          <div className="collection-heading">
            <div>
              <span className="eyebrow">{t('THE COLLECTION')} </span>
              <h2>{savedOnly ? t('Your discoveries.') : t('Find your favorite.')}</h2>
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
          <div className="result-count">
            <span>{t('{count} Pokémon', { count: fmt(filtered.length) })}</span>
            {(query || type || gen !== 0) && <button onClick={clearFilters}>{t('Reset filters')} </button>}
            <Layers3 size={14} />
          </div>
          <div ref={collection} className="collection-scroll">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <Compass size={30} />
                <h3>{savedOnly ? t('Make your first discovery.') : t('No Pokémon found.')}</h3>
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
          <div className="collection-footer">
            <i />
            {t('A world worth a closer look.')}{' '}
          </div>
        </aside>

        <main
          id="main"
          tabIndex={-1}
          className="main-panel"
          inert={mobileCollection && matchMedia('(max-width: 700px)').matches}
        >
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
            <span>{generationName(selected.gen)}</span>
          </div>
          <div className="specimen-heading">
            <div>
              <div className="eyebrow">
                <span className="catalog-number"># {String(selected.id).padStart(4, '0')}</span>
                <span className="tiny-dot" />
                {generationName(selected.gen)}
              </div>
              <h1>
                <bdi lang={details.nameLang}>{details.name}</bdi>
                <span className="title-dot">.</span>
              </h1>
              <div className="type-row">
                {selected.types.map((t) => (
                  <TypePill key={t} type={t} />
                ))}
                <span className="genus" lang={details.genusLang} dir="auto">
                  {details.genus}
                </span>
              </div>
            </div>
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
          </div>

          <section
            ref={studio}
            className={`viewer-stage ${settings.habitat} ${focus ? 'focus-view' : ''}`}
            aria-label={t('{name} interactive 3D studio', { name: details.name })}
          >
            <div className="stage-watermark" aria-hidden="true">
              {String(selected.id).padStart(3, '0')}
            </div>
            <div className="stage-top">
              <span className="live-label">
                <span className={`live-dot ${loading ? 'loading' : ''}`} />
                {loading ? t('Getting closer') : error ? t('Preview unavailable') : t('LIVE VIEW')}
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
                  <span>{t('Opening your studio…')} </span>
                </div>
              }
            >
              <Viewer
                key={reload}
                ref={viewer}
                pokemon={selected}
                model={model}
                settings={settings}
                onLoad={(names) => {
                  setAnimations(names)
                  setError('')
                  setLoading(false)
                }}
                onError={(message) => {
                  setAnimations([])
                  setError(message)
                  setLoading(false)
                }}
                onLoading={(value) => {
                  setLoading(value)
                  if (value) setError('')
                }}
              />
            </Suspense>
            {loading && (
              <div className="loader">
                <LoaderCircle className="spin" size={28} />
                <span>{t('Meeting {name}…', { name: details.name })}</span>
              </div>
            )}
            {error && (
              <div className="viewer-error">
                <Orbit size={34} />
                <h3>{t('A little out of reach.')} </h3>
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
            <div className="stage-caption">
              {settings.habitat === 'forest'
                ? t('FOREST CLEARING')
                : settings.habitat === 'night'
                  ? t('AFTER HOURS')
                  : t('THE OBSERVATORY')}
              <span>
                {settings.habitat === 'studio' ? '01' : settings.habitat === 'forest' ? '02' : '03'} / 03
              </span>
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
              <h2 id="environment-title">{t('A change of scenery.')} </h2>
              <span>{t('SET THE MOOD')} </span>
            </div>
            <div className="environments">
              {(
                [
                  {
                    key: 'studio',
                    title: t('Studio'),
                    text: t('Every detail, illuminated.'),
                    icon: <Sun size={17} />,
                  },
                  {
                    key: 'forest',
                    title: t('Forest'),
                    text: t('A moment in the wild.'),
                    icon: <Leaf size={17} />,
                  },
                  {
                    key: 'night',
                    title: t('Midnight'),
                    text: t('A different kind of quiet.'),
                    icon: <Moon size={17} />,
                  },
                ] as const
              ).map((scene) => (
                <button
                  key={scene.key}
                  className={`environment-card ${scene.key} ${settings.habitat === scene.key ? 'active' : ''}`}
                  aria-pressed={settings.habitat === scene.key}
                  onClick={() => update({ habitat: scene.key })}
                >
                  <span className="environment-art">{scene.icon}</span>
                  <span>
                    <strong>{scene.title}</strong>
                    <small>{scene.text}</small>
                  </span>
                  {settings.habitat === scene.key && <Check size={14} className="scene-check" />}
                </button>
              ))}
            </div>
          </section>
          <div className="specimen-navigation">
            <button onClick={() => move(-1)}>
              <ArrowLeft size={16} />
              {t('Previous')}{' '}
            </button>
            <span>
              {index >= 0 ? String(index + 1).padStart(3, '0') : '—'} <i>/</i> {fmt(filtered.length)}
            </span>
            <button onClick={() => move(1)}>
              {t('Next')} <ArrowRight size={16} />
            </button>
          </div>
        </main>

        <aside
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
              <div className="detail-kicker">
                <Compass size={17} />
                <span>{t('FIELD NOTES')} </span>
              </div>
              <h2>{t('A little more to discover.')}</h2>
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
              <p className="description" lang={details.descriptionLang} dir="auto">
                {details.description}
              </p>
              <div className="measurements">
                <div>
                  <span>{t('HEIGHT')} </span>
                  <strong>
                    {fmt(selected.height)}
                    <small>m</small>
                  </strong>
                </div>
                <div>
                  <span>{t('WEIGHT')} </span>
                  <strong>
                    {fmt(selected.weight)}
                    <small>kg</small>
                  </strong>
                </div>
              </div>
              <section className="stats">
                <div className="section-label">
                  <h3>{t('Base stats')} </h3>
                  <span>
                    {t('TOTAL {number}', { number: fmt(selected.stats.reduce((a, b) => a + b, 0)) })}
                  </span>
                </div>
                {[t('HP'), t('Attack'), t('Defense'), t('Sp. Atk'), t('Sp. Def'), t('Speed')].map(
                  (name, i) => (
                    <div className="stat-row" key={name}>
                      <span>{name}</span>
                      <div className="stat-track">
                        <i style={{ width: `${(selected.stats[i] / 255) * 100}%` }} />
                      </div>
                      <strong>{fmt(selected.stats[i])}</strong>
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
                    <button key={p.id} className="evolution-card" onClick={() => choose(p)}>
                      <img src={art(p.id)} alt="" width="48" height="48" loading="lazy" />
                      <span>
                        <small>{p.id === selected.evolvesFrom ? t('EVOLVES FROM') : t('EVOLVES INTO')}</small>
                        <strong>
                          <bdi lang={species(p).nameLang}>{species(p).name}</bdi>
                        </strong>
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </section>
              )}
              <div className="discovery-note">
                <Orbit size={21} />
                <p>{t('There’s always another side to the story.')}</p>
                <button onClick={() => setTab('studio')}>
                  {t('Make it your own')} <ArrowUpRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-content studio-settings">
              <div className="detail-kicker">
                <SlidersHorizontal size={17} />
                <span>{t('YOUR PERSPECTIVE')} </span>
              </div>
              <h2>{t('The details are yours.')}</h2>
              <p className="description">{t('Find the light. Choose an angle. Take your time.')} </p>
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
              {!model?.shiny && (
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
              {t('Share this discovery')} <ArrowUpRight size={15} />
            </button>
            <button className="about-link" onClick={() => setDialog('about')}>
              {t('About Atlas & credits')}{' '}
            </button>
          </div>
        </aside>
      </div>

      <footer className="footer">
        <span>{t('A CLOSER LOOK. A NEW PERSPECTIVE.')} </span>
        <span>{t('An independent Pokémon fan experience.')} </span>
        <button onClick={() => setDialog('about')}>
          {t('Credits')} <ArrowUpRight size={12} />
        </button>
      </footer>
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
                  <button
                    key={code}
                    data-language={code}
                    className={`language-choice ${code === locale ? 'selected' : ''}`}
                    aria-pressed={code === locale}
                    onClick={() => {
                      chooseLocale(code)
                      setDialog(null)
                    }}
                  >
                    <span>
                      <bdi lang={code}>{native}</bdi>
                      <small>{localeName(code)}</small>
                    </span>
                    {code === locale && <Check size={18} />}
                  </button>
                ))}
              {!locales.some(([code, native, english]) =>
                normalizeSearch(`${code} ${native} ${english} ${localeName(code)}`).includes(
                  normalizeSearch(languageQuery),
                ),
              ) && <p role="status">{t('No languages found.')}</p>}
            </div>
            {preferenceSaved && <p className="setting-note">{t('Your language is saved on this device.')}</p>}
          </div>
        )}
        {dialog === 'help' && (
          <>
            <span className="eyebrow">{t('WELCOME TO ATLAS')} </span>
            <h2>{t('Follow your curiosity.')} </h2>
            <p>{t('Your own little observatory for the world of Pokémon.')} </p>
            <div className="guide-list">
              <div>
                <Orbit />
                <span>
                  <strong>{t('See every side.')} </strong>
                  {t(
                    'Drag to rotate, scroll or pinch to zoom. Use Front, Side, Back, and Top for a new perspective.',
                  )}{' '}
                </span>
              </div>
              <div>
                <Play />
                <span>
                  <strong>{t('Find the moment.')} </strong>
                  {t('Play or pause motion, change its speed, and turn on auto orbit.')}{' '}
                </span>
              </div>
              <div>
                <Sun />
                <span>
                  <strong>{t('Make it yours.')} </strong>
                  {t('Choose a scene, adjust the light in Studio, and save an image.')}{' '}
                </span>
              </div>
              <div>
                <Heart />
                <span>
                  <strong>{t('Keep your favorites.')} </strong>
                  {t('Tap Save to add a Pokémon to your collection on this device.')}{' '}
                </span>
              </div>
            </div>
            <p className="shortcut-note">
              {t('Keyboard: ← / → previous / next · Space play / pause · / search · Esc close')}{' '}
            </p>
          </>
        )}
        {dialog === 'about' && (
          <>
            <span className="eyebrow">{t('ABOUT THIS LITTLE WORLD')} </span>
            <h2>{t('A closer look.')} </h2>
            <p>
              {t(
                'Atlas is an independent, non-commercial fan experience for exploring Pokémon from every angle.',
              )}{' '}
            </p>
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
              · {t('Forest scene generated with OpenAI.')}
            </p>
            <p>
              {t(
                'Model detail and recorded animations vary by species. The collection covers the 1,025 numbered species; alternate forms are not all included.',
              )}{' '}
            </p>
            <p>
              {t(
                'Favorites stay in this browser. Recently opened models are cached when possible. Opening new Pokémon needs an internet connection. No account or tracking is used.',
              )}{' '}
            </p>
          </>
        )}
        {dialog === 'install' && (
          <>
            <span className="eyebrow">{t('TAKE YOUR WORLD WITH YOU')} </span>
            <h2>{t('A home for discovery.')} </h2>
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
