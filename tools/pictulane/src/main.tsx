import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flatten, parseRoute, postStep, routeURL, swipe, username, type Album, type Slide } from './model'
import { loadAlbum, SourceError } from './provider'
import { cachedAlbum, clearHistory, read, recent, remember, resume, saveAlbum, write } from './storage'
import { copies, language, languages } from './i18n'
import { registerWorker, workerMessage } from './pwa'
import './style.css'
const provider =
  import.meta.env.MODE === 'test' ? (await import('../tests/fixture-provider')).loadAlbum : loadAlbum
function App() {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  const [input, setInput] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [lang, setLang] = useState(() => language(read('settings', {} as { language?: unknown })?.language))
  const t = copies[lang]
  const [album, setAlbum] = useState<Album>()
  const [status, setStatus] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [recents, setRecents] = useState(recent)
  const [settings, setSettings] = useState(false)
  const [cacheEnabled, setCacheEnabled] = useState(
    () => read('settings', {} as { cache?: boolean })?.cache !== false,
  )
  const [cacheCount, setCacheCount] = useState<number>()
  const [online, setOnline] = useState(navigator.onLine)
  const [message, setMessage] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [update, setUpdate] = useState<ServiceWorkerRegistration>()
  const [install, setInstall] = useState<Event & { prompt: () => Promise<void> }>()
  const [revealed, setRevealed] = useState<string>()
  const [failed, setFailed] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [loaded, setLoaded] = useState<string>()
  const current = useRef<Slide | undefined>(undefined)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const updating = useRef(false)
  const suppressResume = useRef(false)
  const cachePreference = useRef(cacheEnabled)
  cachePreference.current = cacheEnabled
  const slides = useMemo(
    () => (album && album.username === route.username ? flatten(album) : []),
    [album, route.username],
  )
  const index = slides.findIndex((s) => s.post.id === route.postId && s.key === route.imageKey)
  const slide = slides[index]
  current.current = slide
  const viewer = !!route.postId
  function sync() {
    setRoute(parseRoute(location.hash))
  }
  function navigate(hash: string, replace = false, state: Record<string, unknown> = {}) {
    history[replace ? 'replaceState' : 'pushState'](state, '', hash)
    sync()
  }
  function openSlide(s: Slide) {
    history.replaceState({ scroll: scrollY, focus: s.id }, '', location.href)
    navigate(routeURL(route.username!, s), false, { fromList: true })
  }
  function closeViewer() {
    if (slide && route.username && !suppressResume.current) write(`resume:${route.username}`, slide.id)
    if (history.state?.fromList) history.back()
    else navigate(routeURL(route.username!), true)
  }
  function move(delta: number, byPost = false) {
    if (!slide) return
    const i = byPost ? postStep(slides, index, delta) : index + delta
    if (i < 0 || i >= slides.length) {
      setMessage(delta < 0 ? t.start : album?.range === 'end' ? t.end : t.unavailable)
      return
    }
    setMessage('')
    navigate(routeURL(route.username!, slides[i]), true, history.state)
  }
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  useEffect(() => {
    const fn = () => sync()
    window.addEventListener('popstate', fn)
    window.addEventListener('hashchange', fn)
    return () => {
      window.removeEventListener('popstate', fn)
      window.removeEventListener('hashchange', fn)
    }
  }, [])
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    const st = () => setRecents(recent())
    window.addEventListener('storage', st)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
      window.removeEventListener('storage', st)
    }
  }, [])
  useEffect(() => {
    void registerWorker(setUpdate)
    const controller = () => {
      void workerMessage('configure', { enabled: cachePreference.current })
      if (updating.current) location.reload()
    }
    navigator.serviceWorker?.addEventListener('controllerchange', controller)
    const installEvent = (e: Event) => {
      e.preventDefault()
      setInstall(e as Event & { prompt: () => Promise<void> })
    }
    window.addEventListener('beforeinstallprompt', installEvent)
    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', controller)
      window.removeEventListener('beforeinstallprompt', installEvent)
    }
  }, [])
  useEffect(() => {
    void workerMessage('configure', { enabled: cacheEnabled })
  }, [cacheEnabled])
  useEffect(() => {
    suppressResume.current = false
    if (!route.username) {
      setAlbum(undefined)
      setStatus('')
      return
    }
    const account = route.username
    const controller = new AbortController()
    setAlbum(cachedAlbum(account))
    setStatus('loading')
    remember(account)
    setRecents(recent())
    provider(account, controller.signal)
      .then((a) => {
        if (controller.signal.aborted) return
        setAlbum(a)
        setStatus('')
        if (!saveAlbum(a)) setSaveFailed(true)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setStatus(e instanceof SourceError ? e.code : 'network')
      })
    return () => controller.abort()
  }, [route.username, refresh])
  useEffect(() => {
    if (!viewer) {
      const state = history.state
      requestAnimationFrame(() => {
        if (state?.focus) document.getElementById(`photo-${state.focus}`)?.focus({ preventScroll: true })
        window.scrollTo(0, state?.scroll || 0)
      })
    } else closeButton.current?.focus({ preventScroll: true })
  }, [viewer])
  useEffect(() => {
    if (!slide || !route.username) return
    const account = route.username,
      id = slide.id
    const save = () => {
      if (suppressResume.current) return
      if (!write(`resume:${account}`, id)) setSaveFailed(true)
    }
    const timer = setTimeout(save, 350)
    const hidden = () => {
      if (document.visibilityState === 'hidden') save()
    }
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [slide?.id, route.username])
  useEffect(() => {
    if (!viewer) return
    const handler = (e: KeyboardEvent) => {
      if (settings) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeViewer()
        return
      }
      if (target?.closest('.post-details') && ['ArrowUp', 'ArrowDown'].includes(e.key)) return
      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        move(
          e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1,
          e.key === 'ArrowDown' || e.key === 'ArrowUp',
        )
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
  useEffect(() => {
    if (!slide || (slide.post.sensitive && revealed !== slide.id)) return
    const images = [index - 1, index + 1, index + 2]
      .map((i) => slides[i])
      .filter((s) => s && !s.post.sensitive)
      .map((s) => {
        const im = new Image()
        im.src = s.url
        return im
      })
    return () => {
      for (const im of images) {
        im.onload = null
        im.onerror = null
        im.removeAttribute('src')
      }
    }
  }, [slide?.id, revealed])
  useEffect(() => {
    if (settings) {
      lastFocus.current = document.activeElement as HTMLElement
      dialog.current?.showModal()
      void workerMessage('stats').then((r) => setCacheCount(r.count))
    } else if (dialog.current?.open) {
      dialog.current.close()
      lastFocus.current?.focus()
    }
  }, [settings])
  const gesture = useRef<{ x: number; y: number; time: number; multi: boolean; id: number } | undefined>(
    undefined,
  )
  const settingsSave = (l: string, c: boolean) => {
    if (!write('settings', { language: l, cache: c })) setSaveFailed(true)
  }
  const sourceLink = route.username ? `https://x.com/${route.username}` : undefined
  const error = (
    <div className="notice" role="status">
      <strong>{t.notice}</strong>
      <p>{t.blocked}</p>
      {route.username && (
        <button onClick={() => setRefresh((n) => n + 1)} disabled={status === 'loading'}>
          {t.retry}
        </button>
      )}
    </div>
  )
  return (
    <>
      <header>
        <a className="brand" href="#/" onClick={() => setMessage('')}>
          <img src="/tools/pictulane/icon.svg" alt="" />
          pictulane
        </a>
        <div className="header-actions">
          <select
            aria-label={t.language}
            value={lang}
            onChange={(e) => {
              setLang(e.target.value)
              settingsSave(e.target.value, cacheEnabled)
            }}
          >
            {Object.entries(languages).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <button onClick={() => setSettings(true)}>{t.settings}</button>
        </div>
      </header>
      {!online && (
        <p className="banner" role="status">
          {t.offline}
        </p>
      )}
      {saveFailed && (
        <p className="banner" role="status">
          {t.savedFailure}
        </p>
      )}
      {update && (
        <p className="banner">
          {t.update}{' '}
          <button
            onClick={() => {
              updating.current = true
              if (current.current && route.username && !suppressResume.current)
                write(`resume:${route.username}`, current.current.id)
              update.waiting?.postMessage({ type: 'activate' })
            }}
          >
            {t.apply}
          </button>
        </p>
      )}
      <main hidden={viewer}>
        {!route.username ? (
          <section className="intro">
            <span className="eyebrow">pictulane / PHOTO VIEWER</span>
            <h1>{t.tag}</h1>
            <p className="lead">{t.intro}</p>
          </section>
        ) : (
          <section className="account-heading">
            <div>
              <span className="eyebrow">ALBUM</span>
              <h1>@{route.username}</h1>
            </div>
            <a href={sourceLink} target="_blank" rel="noreferrer">
              {t.profile} ↗
            </a>
          </section>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            try {
              const a = username(input)
              setInvalid(false)
              if (a === route.username) setRefresh((n) => n + 1)
              else navigate(routeURL(a))
            } catch {
              setInvalid(true)
            }
          }}
        >
          <label htmlFor="account">{t.account}</label>
          <div className="input-row">
            <span aria-hidden="true">@</span>
            <input
              id="account"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              placeholder="username / https://x.com/username"
              maxLength={256}
              aria-invalid={invalid}
              aria-describedby={invalid ? 'input-error' : undefined}
            />
            <button className="primary" type="submit">
              {t.open} <span aria-hidden="true">→</span>
            </button>
          </div>
          {invalid && (
            <p id="input-error" role="alert">
              {t.invalid}
            </p>
          )}
        </form>
        {route.invalid && <p role="alert">{t.missing}</p>}
        {!album && status !== 'loading' && error}
        {status === 'loading' && <p role="status">{t.loading}</p>}
        {route.username && (
          <>
            <div className="album-status">
              <span>
                {t.acquired}: {slides.length}
              </span>
              <span>
                {t.fetched}: {album ? new Date(album.fetchedAt).toLocaleString(lang) : t.unknown}
              </span>
              <span>{album?.range === 'end' ? t.end : t.unavailable}</span>
            </div>
            {slides.length > 0 ? (
              <>
                <div className="album-actions">
                  <button className="primary" onClick={() => openSlide(slides[0])}>
                    {t.first}
                  </button>
                  {resume(route.username) && (
                    <button
                      onClick={() => {
                        const s = slides.find((s) => s.id === resume(route.username!))
                        if (s) openSlide(s)
                      }}
                    >
                      {t.resume}
                    </button>
                  )}
                </div>
                <div className="grid">
                  {slides.map((s, i) => (
                    <button
                      className="thumb"
                      id={`photo-${s.id}`}
                      key={s.id}
                      onClick={() => openSlide(s)}
                      aria-label={`${i + 1} · ${s.alt || s.post.id} · ${s.position + 1}/${s.total}`}
                    >
                      <img
                        loading="lazy"
                        decoding="async"
                        src={s.post.sensitive ? '/tools/pictulane/icon.svg' : s.thumb}
                        alt={s.post.sensitive ? t.sensitive : s.alt || ''}
                      />
                      <span>
                        {s.position + 1}/{s.total}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty">
                <span aria-hidden="true">▧</span>
                <p>{t.empty}</p>
              </div>
            )}
          </>
        )}
        {!route.username && recents.length > 0 && (
          <section className="recent">
            <h2>{t.recent}</h2>
            {recents.map((a) => (
              <div key={a}>
                <a href={routeURL(a)}>@{a}</a>
                {resume(a) && (
                  <a href={`#/${a}/status/${resume(a)!.split(':')[0]}/media/${resume(a)!.split(':')[1]}`}>
                    {t.resume} →
                  </a>
                )}
              </div>
            ))}
          </section>
        )}
        <footer>
          <details>
            <summary>{t.privacy}</summary>
            <p>{t.privacyText}</p>
            <p>{t.shortcuts}</p>
          </details>
          <p>pictulane · Independent photo viewer</p>
        </footer>
      </main>
      {viewer && (
        <section className="viewer" aria-label={t.range}>
          <div className="viewer-bar">
            <button ref={closeButton} onClick={closeViewer} aria-label={t.close}>
              ✕
            </button>
            <span>
              @{route.username} <small>{index >= 0 ? `${index + 1} / ${slides.length}` : ''}</small>
            </span>
            <button onClick={() => setSettings(true)}>{t.settings}</button>
          </div>
          {slide ? (
            <>
              <div
                className="stage"
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse') return
                  if (gesture.current) {
                    gesture.current.multi = true
                    return
                  }
                  gesture.current = {
                    x: e.clientX,
                    y: e.clientY,
                    time: performance.now(),
                    multi: !e.isPrimary,
                    id: e.pointerId,
                  }
                }}
                onPointerCancel={() => {
                  gesture.current = undefined
                }}
                onPointerUp={(e) => {
                  const g = gesture.current
                  gesture.current = undefined
                  if (!g || g.id !== e.pointerId) return
                  const d = swipe(
                    e.clientX - g.x,
                    e.clientY - g.y,
                    performance.now() - g.time,
                    innerWidth,
                    g.x,
                    visualViewport?.scale || 1,
                    g.multi,
                  )
                  if (d) move(d)
                }}
              >
                {slide.post.sensitive && revealed !== slide.id ? (
                  <div className="image-state">
                    <p>{t.sensitive}</p>
                    <button onClick={() => setRevealed(slide.id)}>{t.reveal}</button>
                  </div>
                ) : (
                  <>
                    <img
                      key={`${slide.id}-${retry}`}
                      className="main-image"
                      data-image-id={slide.id}
                      src={slide.url}
                      alt={slide.alt || `@${slide.post.author} · ${slide.position + 1}/${slide.total}`}
                      onLoad={() => {
                        setLoaded(slide.id)
                        setFailed(undefined)
                      }}
                      onError={() => {
                        setFailed(slide.id)
                        void workerMessage('invalidate', { url: slide.url })
                      }}
                    />
                    {failed === slide.id ? (
                      <div className="image-state">
                        <p>{t.failed}</p>
                        <button
                          onClick={() => {
                            setFailed(undefined)
                            setLoaded(undefined)
                            setRetry((n) => n + 1)
                          }}
                        >
                          {t.retry}
                        </button>
                      </div>
                    ) : (
                      loaded !== slide.id && (
                        <span className="image-loading" role="status">
                          …
                        </span>
                      )
                    )}
                  </>
                )}
                <button
                  className="arrow previous"
                  onClick={() => move(-1)}
                  aria-label={t.prev}
                  disabled={index === 0}
                >
                  ‹
                </button>
                <button
                  className="arrow next"
                  onClick={() => move(1)}
                  aria-label={t.next}
                  disabled={index === slides.length - 1}
                >
                  ›
                </button>
              </div>
              <div className="viewer-info">
                <div className="meta">
                  <span>
                    {slide.position + 1} / {slide.total}
                  </span>
                  <span>{slide.post.date ? new Date(slide.post.date).toLocaleString(lang) : ''}</span>
                  <a
                    href={`https://x.com/${slide.post.author}/status/${slide.post.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.post} ↗
                  </a>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(slide.url)
                        setMessage(t.copied)
                      } catch {
                        setMessage(t.copyFailed)
                      }
                    }}
                  >
                    {t.copy}
                  </button>
                </div>
                <details className="post-details">
                  <summary>{t.details}</summary>
                  <p>{slide.post.text}</p>
                  <p>{slide.alt}</p>
                </details>
                <p className="range">
                  {t.range} ·{' '}
                  {index === 0
                    ? t.start
                    : index === slides.length - 1
                      ? album?.range === 'end'
                        ? t.end
                        : t.unavailable
                      : t.shortcuts}
                </p>
                <p role="status" className="feedback">
                  {message}
                </p>
              </div>
            </>
          ) : (
            <div className="unresolved">
              <h1>{t.missing}</h1>
              <p>{status === 'loading' ? t.loading : t.blocked}</p>
              <button onClick={() => setRefresh((n) => n + 1)}>{t.retry}</button>
              <button onClick={() => navigate(routeURL(route.username!), true)}>{t.list}</button>
              <a href={`${sourceLink}/status/${route.postId}`} target="_blank" rel="noreferrer">
                {t.post} ↗
              </a>
            </div>
          )}
        </section>
      )}
      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault()
          setSettings(false)
        }}
      >
        <div className="dialog-heading">
          <h2>{t.settings}</h2>
          <button aria-label={t.close} onClick={() => setSettings(false)}>
            ✕
          </button>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={cacheEnabled}
            onChange={(e) => {
              const v = e.target.checked
              setCacheEnabled(v)
              settingsSave(lang, v)
              void workerMessage('configure', { enabled: v })
            }}
          />
          {t.cache}
        </label>
        <p>
          {t.cached}: {cacheCount ?? t.noCache}
        </p>
        <div className="settings-actions">
          <button
            onClick={async () => {
              const r = await workerMessage('clear')
              setCacheCount(r.count)
            }}
          >
            {t.clearCache}
          </button>
          <button
            onClick={() => {
              suppressResume.current = true
              clearHistory()
              setRecents([])
            }}
          >
            {t.clearHistory}
          </button>
          {install && (
            <button
              onClick={() => {
                void install.prompt()
                setInstall(undefined)
              }}
            >
              {t.install}
            </button>
          )}
        </div>
        <p>{t.installHelp}</p>
        <p>{t.privacyText}</p>
      </dialog>
    </>
  )
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
