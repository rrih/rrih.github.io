import { useEffect, useSyncExternalStore } from 'react'
import { locales } from './locales'

export const AD_CLIENT = 'ca-pub-6426570202991325'
export const AD_SLOT = '9649739784'
const SCRIPT_ID = 'atlas-advertising'
const CMP_SCRIPT_ID = 'atlas-ad-consent'
const CMP_SCRIPT_URL = 'https://fundingchoicesmessages.google.com/i/pub-6426570202991325?ers=1'
const SCRIPT_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`
const unsupportedLocales = new Set(['is', 'fa', 'ne', 'sw', 'af'])
const supportedLocales = new Set<string>(
  locales.map(([locale]) => locale).filter((locale) => !unsupportedLocales.has(locale)),
)

export function isAdvertisingPage(hostname: string, locale: string): boolean {
  return hostname === 'rrih.github.io' && supportedLocales.has(locale)
}

export interface TcfData {
  cmpStatus?: string
  eventStatus?: string
  gdprApplies?: boolean
  tcString?: string
  purpose?: { consents?: Record<string, boolean> }
  vendor?: { consents?: Record<string, boolean> }
}

/** This is a minimum request gate. Google still evaluates the complete TCF signal. */
export function permitsTcfAdvertising(data: TcfData | null | undefined, success: boolean): boolean {
  if (success !== true || !data || data.cmpStatus === 'error') return false
  // TCF permits the remaining fields to be omitted when it does not apply.
  if (data.gdprApplies === false) return true
  return (
    data.gdprApplies === true &&
    data.cmpStatus === 'loaded' &&
    (data.eventStatus === 'tcloaded' || data.eventStatus === 'useractioncomplete') &&
    typeof data.tcString === 'string' &&
    data.tcString.length > 0 &&
    data.purpose?.consents?.['1'] === true &&
    data.vendor?.consents?.['755'] === true
  )
}

export function permitsInitialUsAdvertising(status: unknown): boolean {
  // Google InitialUsStatesOptOutStatusEnum: 0 unknown, 1 not applicable, 2 not opted out, 3 opted out.
  return status === 1 || status === 2
}

interface GppData {
  cmpStatus?: string
  signalStatus?: string
  gppString?: string
}
interface GppEvent {
  eventName?: string
  pingData?: GppData
}
type FcCallback = (() => void) | Record<string, () => void>
interface GoogleFc {
  callbackQueue?: { push: (callback: FcCallback) => unknown }
  showRevocationMessage?: () => void
  usstatesoptout?: {
    overrideDnsLink?: boolean
    getInitialUsStatesOptOutStatus?: () => number
    openConfirmationDialog?: (callback: (optedOut: boolean) => void) => void
  }
}
interface AdvertisingWindow extends Window {
  adsbygoogle?: {
    push: (value: Record<string, never>) => unknown
    pauseAdRequests?: number
    requestNonPersonalizedAds?: number
  }
  googlefc?: GoogleFc
  __tcfapi?: (
    command: 'addEventListener',
    version: number,
    callback: (data: TcfData | null, success: boolean) => void,
  ) => void
  __gpp?: (command: 'addEventListener', callback: (data: GppEvent | null, success: boolean) => void) => void
}

export interface AdvertisingState {
  enabled: boolean
  scriptReady: boolean
  scriptFailed: boolean
  canReopenConsent: boolean
  canOpenUsChoices: boolean
}
const emptyState: AdvertisingState = {
  enabled: false,
  scriptReady: false,
  scriptFailed: false,
  canReopenConsent: false,
  canOpenUsChoices: false,
}
const getEmptyState = () => emptyState
const noopSubscribe = () => () => {}

/** One controller and one pair of CMP listeners per document, including StrictMode remounts. */
export function createAdvertisingController(target: Window, page: Document) {
  const browser = target as AdvertisingWindow
  const listeners = new Set<() => void>()
  let snapshot = emptyState
  let active = false
  let started = false
  let ready = false
  let failed = false
  let tcfAllowed = false
  let gdprApplies: boolean | undefined
  let usStatus = 0
  let gppReady = false
  let initialGpp: string | undefined
  let usChoicesChanged = false
  let tcfSubscribed = false
  let gppSubscribed = false

  const refresh = () => {
    const enabled =
      active &&
      ready &&
      !failed &&
      tcfAllowed &&
      permitsInitialUsAdvertising(usStatus) &&
      (usStatus === 1 || (gppReady && !usChoicesChanged))
    if (started && browser.adsbygoogle) {
      browser.adsbygoogle.requestNonPersonalizedAds = 1
      browser.adsbygoogle.pauseAdRequests = enabled ? 0 : 1
    }
    const next: AdvertisingState = {
      enabled,
      scriptReady: ready && !failed,
      scriptFailed: failed,
      // A failed ad SDK must not remove the working CMP's withdrawal controls.
      canReopenConsent:
        active && gdprApplies === true && typeof browser.googlefc?.showRevocationMessage === 'function',
      canOpenUsChoices:
        active &&
        usStatus === 2 &&
        typeof browser.googlefc?.usstatesoptout?.openConfirmationDialog === 'function',
    }
    if (
      Object.keys(next).every(
        (key) => next[key as keyof AdvertisingState] === snapshot[key as keyof AdvertisingState],
      )
    )
      return
    snapshot = next
    for (const listener of listeners) listener()
  }

  const subscribeCmp = () => {
    // The queue key only makes the APIs callable; their data must independently pass the gate.
    if (!tcfSubscribed && typeof browser.__tcfapi === 'function') {
      tcfSubscribed = true
      try {
        // Google's API documents version 0 as the latest supported TCF version.
        browser.__tcfapi('addEventListener', 0, (data, success) => {
          gdprApplies = success === true && data?.cmpStatus !== 'error' ? data?.gdprApplies : undefined
          tcfAllowed = permitsTcfAdvertising(data, success)
          refresh()
        })
      } catch {
        tcfAllowed = false
        refresh()
      }
    }
    if (!gppSubscribed && typeof browser.__gpp === 'function') {
      gppSubscribed = true
      try {
        browser.__gpp('addEventListener', (event, success) => {
          const data = event?.pingData
          gppReady = !!(
            success === true &&
            event?.eventName !== 'error' &&
            data?.cmpStatus === 'loaded' &&
            data.signalStatus === 'ready' &&
            typeof data.gppString === 'string' &&
            data.gppString.length > 0
          )
          if (initialGpp !== undefined && (!gppReady || data?.gppString !== initialGpp)) {
            // Initial US status is a snapshot. On later changes, retire this document's ad;
            // never reuse that old permission or refresh the unit with a new request.
            usChoicesChanged = true
          }
          if (gppReady && initialGpp === undefined) initialGpp = data?.gppString
          refresh()
        })
      } catch {
        gppReady = false
        refresh()
      }
    }
    refresh()
  }

  const start = () => {
    if (started || browser.location.hostname !== 'rrih.github.io') return
    started = true
    const ads: NonNullable<AdvertisingWindow['adsbygoogle']> =
      browser.adsbygoogle ?? ([] as Record<string, never>[])
    browser.adsbygoogle = ads
    ads.pauseAdRequests = 1
    ads.requestNonPersonalizedAds = 1
    browser.googlefc ??= {}
    const callbacks: NonNullable<GoogleFc['callbackQueue']> =
      browser.googlefc.callbackQueue ?? ([] as FcCallback[])
    browser.googlefc.callbackQueue = callbacks
    browser.googlefc.usstatesoptout ??= {}
    browser.googlefc.usstatesoptout.overrideDnsLink = true

    // Official callback keys, TCF/GPP listeners, and revocation methods:
    // https://developers.google.com/funding-choices/fc-api-docs
    callbacks.push({ CONSENT_API_READY: subscribeCmp })
    callbacks.push({ CONSENT_DATA_READY: subscribeCmp })
    callbacks.push({
      INITIAL_US_STATES_OPT_OUT_DATA_READY: () => {
        try {
          const status = browser.googlefc?.usstatesoptout?.getInitialUsStatesOptOutStatus?.()
          usStatus = status === 1 || status === 2 || status === 3 ? status : 0
        } catch {
          usStatus = 0
        }
        subscribeCmp()
        refresh()
      },
    })

    // Do not adopt an unowned tag: its privacy defaults may have been set too late.
    if (
      page.getElementById(SCRIPT_ID) ||
      page.getElementById(CMP_SCRIPT_ID) ||
      page.querySelector('script[src*="fundingchoicesmessages.google.com/i/pub-"]') ||
      page.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')
    ) {
      failed = true
      refresh()
      return
    }
    // Google's separately installed Funding Choices tag and presence marker allow the CMP
    // to initialize while AdSense requests are paused. URL copied from the site's official tag UI.
    if (!page.querySelector('iframe[name="googlefcPresent"]')) {
      const marker = page.createElement('iframe')
      marker.name = 'googlefcPresent'
      marker.style.display = 'none'
      marker.tabIndex = -1
      marker.ariaHidden = 'true'
      page.body.append(marker)
    }
    const loadScript = (id: string, url: string, advertising: boolean) => {
      const script = page.createElement('script')
      script.id = id
      script.async = true
      script.referrerPolicy = 'strict-origin-when-cross-origin'
      if (advertising) {
        script.crossOrigin = 'anonymous'
        script.dataset.privacyTreatments = 'disablePersonalization'
      }
      script.src = url
      // Script pausing/NPA/PPT: https://support.google.com/adsense/answer/7670312
      const fail = () => {
        browser.clearTimeout(timeout)
        failed = true
        script.onload = null
        script.onerror = null
        script.remove()
        refresh()
      }
      const timeout = browser.setTimeout(fail, 30_000)
      script.onerror = fail
      script.onload = () => {
        browser.clearTimeout(timeout)
        if (failed) return
        if (advertising) ready = true
        refresh()
      }
      page.head.append(script)
    }
    loadScript(SCRIPT_ID, SCRIPT_URL, true)
    loadScript(CMP_SCRIPT_ID, CMP_SCRIPT_URL, false)
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setActive: (permitted: boolean) => {
      active = permitted && browser.location.hostname === 'rrih.github.io'
      if (active) {
        try {
          start()
        } catch {
          failed = true
        }
      }
      refresh()
    },
    reopenConsent: () => {
      if (!snapshot.canReopenConsent) return
      tcfAllowed = false
      refresh()
      browser.googlefc?.callbackQueue?.push({
        CONSENT_API_READY: () => {
          try {
            browser.googlefc?.showRevocationMessage?.()
          } catch {
            tcfAllowed = false
            refresh()
          }
        },
      })
    },
    openUsChoices: () => {
      if (!snapshot.canOpenUsChoices) return
      usChoicesChanged = true
      refresh()
      browser.googlefc?.callbackQueue?.push({
        INITIAL_US_STATES_OPT_OUT_DATA_READY: () => {
          try {
            browser.googlefc?.usstatesoptout?.openConfirmationDialog?.((optedOut) => {
              if (optedOut === true) usStatus = 3
              refresh()
            })
          } catch {
            usStatus = 0
            refresh()
          }
        },
      })
    },
  }
}

const controllers = new WeakMap<Document, ReturnType<typeof createAdvertisingController>>()

export function useAdvertising(locale: string) {
  let controller: ReturnType<typeof createAdvertisingController> | undefined
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    controller = controllers.get(document)
    if (!controller) {
      controller = createAdvertisingController(window, document)
      controllers.set(document, controller)
    }
  }
  const eligible = typeof window !== 'undefined' && isAdvertisingPage(window.location.hostname, locale)
  const state = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getSnapshot ?? getEmptyState,
    getEmptyState,
  )
  useEffect(() => {
    controller?.setActive(eligible)
    return () => controller?.setActive(false)
  }, [controller, eligible])
  return {
    ...state,
    enabled: eligible && state.enabled,
    canReopenConsent: eligible && state.canReopenConsent,
    canOpenUsChoices: eligible && state.canOpenUsChoices,
    reopenConsent: controller?.reopenConsent ?? (() => {}),
    openUsChoices: controller?.openUsChoices ?? (() => {}),
  }
}
