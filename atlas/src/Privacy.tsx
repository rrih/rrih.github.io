import { useEffect, useRef, useState } from 'react'
import { useLocale } from './i18n'
import { locales } from './locales'
import { setTelemetryEnabled } from './telemetry'

const MEASUREMENT_ID = 'G-4GYW68LVTM'
const STORAGE_KEY = 'atlas-privacy-v1'
const SCRIPT_ID = 'atlas-analytics'
const knownLocales = new Set<string>(locales.map(([code]) => code))
const safePage = {
  page_location: 'https://rrih.github.io/atlas/',
  page_title: 'Pokémon Atlas',
  page_referrer: '',
}
type Choice = 'accepted' | 'declined' | null
type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  'ga-disable-G-4GYW68LVTM'?: boolean
}
let permitted = false
let initialized = false
let loading: Promise<boolean> | null = null
let cancelLoad: (() => void) | null = null
let users = 0

function readChoice(): Choice {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return value?.version === 1 &&
      typeof value.analytics === 'boolean' &&
      typeof value.updatedAt === 'string' &&
      Number.isFinite(Date.parse(value.updatedAt))
      ? value.analytics
        ? 'accepted'
        : 'declined'
      : null
  } catch {
    return null
  }
}

// Capture before locale loading: a later opt-in cannot authorize earlier page metrics.
const consentAtNavigation = readChoice() === 'accepted'

function saveChoice(analytics: boolean): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, analytics, updatedAt: new Date().toISOString() }),
    )
    return true
  } catch {
    if (!analytics) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* The current visit still opts out when storage is inaccessible. */
      }
    }
    return false
  }
}

function command(...args: unknown[]) {
  if (!permitted || args.length === 0) return
  const target = window as AnalyticsWindow
  target.dataLayer ??= []
  // biome-ignore lint/complexity/noArguments: gtag.js documents an IArguments command queue.
  target.dataLayer.push(arguments)
}

function clearAnalyticsCookies() {
  // Only cookies created for this app, never other sites' preferences or sessions.
  try {
    for (const entry of document.cookie.split(';')) {
      const name = entry.trim().split('=')[0]
      if (name !== '_ga' && name !== '_ga_4GYW68LVTM') continue
      for (const domain of ['', location.hostname, `.${location.hostname}`]) {
        // biome-ignore lint/suspicious/noDocumentCookie: Also support browsers without Cookie Store API.
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`
      }
    }
  } catch {
    /* Browsers can reject cookie access independently of local storage. */
  }
}

function stopAnalytics() {
  setTelemetryEnabled(false)
  permitted = false
  // Google's documented opt-out flag also stops the already-executing library.
  ;(window as AnalyticsWindow)['ga-disable-G-4GYW68LVTM'] = true
  cancelLoad?.()
  cancelLoad = null
  clearAnalyticsCookies()
}

function startAnalytics(): Promise<boolean> {
  if (location.hostname !== 'rrih.github.io') return Promise.resolve(false)
  permitted = true
  ;(window as AnalyticsWindow)['ga-disable-G-4GYW68LVTM'] = false
  if (initialized) return Promise.resolve(true)
  if (loading) return loading

  command('consent', 'default', {
    analytics_storage: 'granted',
  })
  command('set', { ...safePage, ads_data_redaction: true, url_passthrough: false })
  command('js', new Date())
  command('config', MEASUREMENT_ID, {
    ...safePage,
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: location.hostname,
    cookie_path: '/',
    cookie_flags: 'SameSite=Lax;Secure',
  })
  loading = new Promise<boolean>((resolve) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.async = true
    script.referrerPolicy = 'no-referrer'
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
    const cancel = () => {
      script.onload = null
      script.onerror = null
      script.remove()
      loading = null
      // Analytics alone owns dataLayer; the separate advertising CMP uses its own APIs.
      // Never replay pre-withdrawal Analytics commands on re-consent.
      ;(window as AnalyticsWindow).dataLayer = []
      resolve(false)
    }
    cancelLoad = cancel
    script.onerror = () => {
      cancelLoad = null
      cancel()
    }
    script.onload = () => {
      cancelLoad = null
      initialized = permitted
      resolve(permitted)
    }
    document.head.append(script)
  })
  return loading
}

function enableTelemetry() {
  if (!permitted) return
  setTelemetryEnabled(
    true,
    (name, parameters) => {
      command('event', name, { ...parameters, ...safePage, send_to: MEASUREMENT_ID })
    },
    { fromNavigationStart: consentAtNavigation },
  )
}

/** Restore saved consent before Viewer begins its first model load. */
export function initializeSavedAnalytics() {
  if (readChoice() !== 'accepted') return
  void startAnalytics()
  enableTelemetry()
}

export interface PrivacyProps {
  pageId: number
  formId?: string
  locale: string
}

export function Privacy({ pageId, formId, locale }: PrivacyProps) {
  const { t } = useLocale()
  const [choice, setChoice] = useState<Choice>(readChoice)
  const [expanded, setExpanded] = useState(
    () => readChoice() === null || new URLSearchParams(location.search).get('privacy') === '1',
  )
  const [saved, setSaved] = useState(true)
  const lastView = useRef('')

  useEffect(() => {
    users += 1
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return
      const next = readChoice()
      if (next !== 'accepted') stopAnalytics()
      setChoice(next)
      setSaved(true)
      if (next === null) setExpanded(true)
    }
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('storage', sync)
      users -= 1
      // React StrictMode remounts immediately; a real unmount disables collection.
      queueMicrotask(() => {
        if (users === 0) stopAnalytics()
      })
    }
  }, [])

  useEffect(() => {
    if (choice !== 'accepted') {
      stopAnalytics()
      lastView.current = ''
      return
    }
    let current = true
    // IDs only detect in-app navigation; neither ID is included in the payload.
    const identity = JSON.stringify([pageId, formId, locale])
    const started = startAnalytics()
    enableTelemetry()
    void started.then((ready) => {
      if (!ready || !current || !permitted || identity === lastView.current) return
      lastView.current = identity
      command('event', 'page_view', {
        ...safePage,
        send_to: MEASUREMENT_ID,
        language: knownLocales.has(locale) ? locale : 'en',
      })
    })
    return () => {
      current = false
    }
  }, [choice, pageId, formId, locale])

  const choose = (analytics: boolean) => {
    if (!analytics) stopAnalytics()
    const stored = saveChoice(analytics)
    setSaved(stored)
    setChoice(analytics ? 'accepted' : 'declined')
    setExpanded(!stored)
  }

  return (
    <details
      className="privacy-settings"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{t('Privacy settings')}</summary>
      <section className="privacy-panel" aria-label={t('Optional analytics')}>
        <h2>{t('Optional analytics')}</h2>
        <p>{t('Analytics is off until you agree. Your images and saved scenes are never sent.')}</p>
        <p role="status">{t(choice === 'accepted' ? 'Analytics is on.' : 'Analytics is off.')}</p>
        <div className="privacy-actions">
          {choice === 'accepted' ? (
            <button type="button" onClick={() => choose(false)}>
              {t('Stop analytics')}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => choose(true)}>
                {t('Accept analytics')}
              </button>
              <button type="button" onClick={() => choose(false)}>
                {t('Decline')}
              </button>
            </>
          )}
          <a href={`/atlas/legal/${locale === 'ja' ? 'ja' : 'en'}/privacy.html`}>{t('Privacy policy')}</a>
        </div>
      </section>
      {!saved && <p role="status">{t('Your choice could not be saved. It will apply for this visit.')}</p>}
    </details>
  )
}
