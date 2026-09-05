import { describe, expect, test } from 'bun:test'
import {
  AD_CLIENT,
  AD_SLOT,
  createAdvertisingController,
  isAdvertisingPage,
  permitsInitialUsAdvertising,
  permitsTcfAdvertising,
  type TcfData,
} from '../src/advertising'
import { locales } from '../src/locales'

const accepted: TcfData = {
  gdprApplies: true,
  cmpStatus: 'loaded',
  eventStatus: 'useractioncomplete',
  tcString: 'test-consent-string',
  purpose: { consents: { '1': true } },
  vendor: { consents: { '755': true } },
}

interface FakeScript {
  id?: string
  src?: string
  referrerPolicy?: string
  dataset: Record<string, string>
  style: Record<string, string>
  onload?: (() => void) | null
  onerror?: (() => void) | null
  removed: boolean
  remove: () => void
}
type TcfCallback = (data: TcfData | null, success: boolean) => void
interface GppEvent {
  eventName: string
  pingData: { cmpStatus: string; signalStatus: string; gppString: string }
}
type GppCallback = (data: GppEvent, success: boolean) => void
type FcEntry = Record<string, () => void>
interface FakeBrowser {
  location: { hostname: string }
  adsbygoogle: Array<Record<string, never>> & {
    pauseAdRequests: number
    requestNonPersonalizedAds: number
  }
  googlefc: {
    callbackQueue: { push: (entry: FcEntry) => unknown }
    showRevocationMessage: () => void
    usstatesoptout: {
      overrideDnsLink: boolean
      getInitialUsStatesOptOutStatus: () => number
      openConfirmationDialog: (callback: (optedOut: boolean) => void) => void
    }
  }
  __tcfapi: (command: string, version: number, callback: TcfCallback) => void
  __gpp: (command: string, callback: GppCallback) => void
}

/** A controllable CMP, with independent script/API/consent readiness and no network or real timers. */
function makeBrowser(hostname = 'rrih.github.io', existingScript = false) {
  const scripts: FakeScript[] = []
  const timers = new Map<number, () => void>()
  let timerId = 0
  const page = {
    getElementById: () => (existingScript ? {} : null),
    querySelector: () => null,
    createElement: () => {
      const script: FakeScript = {
        dataset: {},
        style: {},
        removed: false,
        remove: () => {
          script.removed = true
        },
      }
      return script
    },
    body: { append: () => {} },
    head: { append: (script: FakeScript) => scripts.push(script) },
  }
  const browser = {
    location: { hostname },
    setTimeout: (callback: () => void) => {
      timers.set(++timerId, callback)
      return timerId
    },
    clearTimeout: (id: number) => timers.delete(id),
  } as unknown as FakeBrowser
  const controller = createAdvertisingController(browser as unknown as Window, page as unknown as Document)
  let tcfCallback: TcfCallback | undefined
  let gppCallback: GppCallback | undefined
  let initialUsStatus = 1
  let tcfSubscriptions = 0
  let gppSubscriptions = 0
  let euReopened = 0
  let usChoice: ((optedOut: boolean) => void) | undefined
  const published = new Set<string>()
  const called = new Set<FcEntry>()
  let entries: FcEntry[] = []
  const invoke = (entry: FcEntry) => {
    if (called.has(entry)) return
    for (const [key, callback] of Object.entries(entry)) {
      if (!published.has(key)) continue
      called.add(entry)
      callback()
    }
  }
  const installCmp = () => {
    entries = browser.googlefc.callbackQueue as FcEntry[]
    browser.googlefc.callbackQueue = {
      push: (entry) => {
        entries.push(entry)
        invoke(entry)
      },
    }
    browser.__tcfapi = (_command, _version, callback) => {
      tcfSubscriptions++
      tcfCallback = callback
    }
    browser.__gpp = (_command, callback) => {
      gppSubscriptions++
      gppCallback = callback
    }
    browser.googlefc.showRevocationMessage = () => {
      euReopened++
    }
    browser.googlefc.usstatesoptout.getInitialUsStatesOptOutStatus = () => initialUsStatus
    browser.googlefc.usstatesoptout.openConfirmationDialog = (callback) => {
      usChoice = callback
    }
  }
  return {
    browser,
    controller,
    scripts,
    installCmp,
    publish: (key: string) => {
      published.add(key)
      for (const entry of [...entries]) invoke(entry)
    },
    setInitialUsStatus: (status: number) => {
      initialUsStatus = status
    },
    tcf: (data: TcfData | null, success = true) => {
      expect(tcfCallback).toBeFunction()
      tcfCallback?.(data, success)
    },
    gpp: (gppString = 'initial', signalStatus = 'ready', success = true) => {
      expect(gppCallback).toBeFunction()
      gppCallback?.(
        { eventName: 'signalStatus', pingData: { cmpStatus: 'loaded', signalStatus, gppString } },
        success,
      )
    },
    resolveUsChoice: (optedOut: boolean) => usChoice?.(optedOut),
    getEuReopened: () => euReopened,
    getSubscriptions: () => [tcfSubscriptions, gppSubscriptions],
    expireScript: () => {
      for (const callback of [...timers.values()]) callback()
    },
  }
}

function startBrowser(usStatus = 1) {
  const context = makeBrowser()
  context.controller.setActive(true)
  context.installCmp()
  context.setInitialUsStatus(usStatus)
  context.scripts[0].onload?.()
  context.publish('CONSENT_API_READY')
  return context
}

describe('advertising eligibility', () => {
  test('permits exactly the 44 supported app languages on the production hostname', () => {
    expect(locales.filter(([locale]) => isAdvertisingPage('rrih.github.io', locale))).toHaveLength(44)
    for (const locale of ['is', 'fa', 'ne', 'sw', 'af', 'unknown']) {
      expect(isAdvertisingPage('rrih.github.io', locale)).toBe(false)
    }
    for (const hostname of ['localhost', 'evil.rrih.github.io', 'rrih.github.io.evil', '']) {
      expect(isAdvertisingPage(hostname, 'en')).toBe(false)
    }
    const foreign = makeBrowser('localhost')
    foreign.controller.setActive(true)
    expect(foreign.scripts).toHaveLength(0)
    expect(foreign.controller.getSnapshot().enabled).toBe(false)
  })

  test('unknown, error, open-dialog and incomplete GDPR responses do not permit NPA', () => {
    const denied = [
      undefined,
      null,
      {},
      { gdprApplies: true },
      { ...accepted, cmpStatus: 'loading' },
      { ...accepted, eventStatus: 'cmpuishown' },
      { ...accepted, tcString: '' },
      { ...accepted, purpose: { consents: { '1': false } } },
      { ...accepted, vendor: { consents: { '755': false } } },
      { gdprApplies: false, cmpStatus: 'error' },
    ]
    for (const data of denied) expect(permitsTcfAdvertising(data, true)).toBe(false)
    expect(permitsTcfAdvertising(accepted, false)).toBe(false)
    expect(permitsTcfAdvertising(accepted, true)).toBe(true)
    // A successful non-applicable response may omit the remaining TCData fields.
    expect(permitsTcfAdvertising({ gdprApplies: false }, true)).toBe(true)
    for (const status of [undefined, null, 0, 3, 4, '1'])
      expect(permitsInitialUsAdvertising(status)).toBe(false)
    expect(permitsInitialUsAdvertising(1)).toBe(true)
    expect(permitsInitialUsAdvertising(2)).toBe(true)
  })
})

describe('advertising controller', () => {
  test('StrictMode/remounts retain one of each script, one listener per framework and no ad pushes', () => {
    const { controller, browser, scripts, installCmp, publish, getSubscriptions } = makeBrowser()
    controller.setActive(true)
    controller.setActive(false)
    controller.setActive(true)
    expect(scripts).toHaveLength(2)
    expect(browser.adsbygoogle).toHaveLength(0)
    expect(browser.adsbygoogle.pauseAdRequests).toBe(1)
    expect(browser.adsbygoogle.requestNonPersonalizedAds).toBe(1)
    expect(scripts[0].src).toBe(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`,
    )
    expect(scripts[0].dataset.privacyTreatments).toBe('disablePersonalization')
    expect(scripts[0].referrerPolicy).toBe('strict-origin-when-cross-origin')
    expect(scripts[1].src).toBe('https://fundingchoicesmessages.google.com/i/pub-6426570202991325?ers=1')
    expect(AD_SLOT).toBe('9649739784')
    installCmp()
    publish('CONSENT_API_READY')
    publish('CONSENT_DATA_READY')
    publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
    expect(getSubscriptions()).toEqual([1, 1])
    expect(browser.googlefc.usstatesoptout.overrideDnsLink).toBe(true)
    expect(browser.adsbygoogle).toHaveLength(0)
  })

  test('API availability alone does not allow ads; known non-applicability for both regions does', () => {
    const context = startBrowser()
    expect(context.controller.getSnapshot().enabled).toBe(false)
    context.tcf({ gdprApplies: false })
    expect(context.controller.getSnapshot().enabled).toBe(false)
    context.publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
    expect(context.controller.getSnapshot().enabled).toBe(true)
    expect(context.browser.adsbygoogle.pauseAdRequests).toBe(0)
    context.tcf(null, false)
    expect(context.controller.getSnapshot().enabled).toBe(false)
    expect(context.browser.adsbygoogle.pauseAdRequests).toBe(1)
  })

  test('EU re-open immediately pauses ads, propagates refusal and never revives them after deactivation', () => {
    const context = startBrowser()
    context.publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
    context.tcf(accepted)
    expect(context.controller.getSnapshot().enabled).toBe(true)
    expect(context.controller.getSnapshot().canReopenConsent).toBe(true)
    context.controller.reopenConsent()
    expect(context.getEuReopened()).toBe(1)
    expect(context.controller.getSnapshot().enabled).toBe(false)
    expect(context.browser.adsbygoogle.pauseAdRequests).toBe(1)
    context.tcf({ ...accepted, purpose: { consents: { '1': false } } })
    expect(context.controller.getSnapshot().enabled).toBe(false)
    context.controller.setActive(false)
    context.tcf(accepted)
    expect(context.controller.getSnapshot().enabled).toBe(false)
    expect(context.browser.adsbygoogle).toHaveLength(0)
  })

  test('US request eligibility waits for current GPP and a custom opt-out removes permission', () => {
    const context = startBrowser(2)
    context.tcf({ gdprApplies: false })
    context.publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
    expect(context.controller.getSnapshot().enabled).toBe(false)
    context.gpp()
    expect(context.controller.getSnapshot().enabled).toBe(true)
    expect(context.controller.getSnapshot().canOpenUsChoices).toBe(true)
    context.controller.openUsChoices()
    expect(context.controller.getSnapshot().enabled).toBe(false)
    context.resolveUsChoice(true)
    expect(context.controller.getSnapshot().canOpenUsChoices).toBe(false)
    expect(context.browser.adsbygoogle.pauseAdRequests).toBe(1)
    expect(context.browser.adsbygoogle).toHaveLength(0)
  })

  test('a native GPP change retires stale initial permission, even if it arrives before the initial US callback', () => {
    for (const initialCallbackFirst of [true, false]) {
      const context = startBrowser(2)
      context.tcf({ gdprApplies: false })
      if (initialCallbackFirst) context.publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
      context.gpp('before')
      context.gpp('before', 'not ready')
      context.gpp('after')
      if (!initialCallbackFirst) context.publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
      expect(context.controller.getSnapshot().enabled).toBe(false)
      expect(context.browser.adsbygoogle.pauseAdRequests).toBe(1)
    }
  })

  test('an initial US opt-out or unknown response cannot be replaced by otherwise-ready signals', () => {
    for (const status of [0, 3]) {
      const context = startBrowser(status)
      context.tcf({ gdprApplies: false })
      context.gpp()
      context.publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
      expect(context.controller.getSnapshot().enabled).toBe(false)
      expect(context.controller.getSnapshot().canOpenUsChoices).toBe(false)
    }
  })

  test('script errors/timeouts are terminal for the document, with no delayed consent bypass or retry', () => {
    for (const failedScript of [0, 1])
      for (const timeout of [false, true]) {
        const context = makeBrowser()
        context.controller.setActive(true)
        const lateLoad = context.scripts[0].onload
        context.installCmp()
        context.publish('CONSENT_API_READY')
        if (timeout) context.expireScript()
        else context.scripts[failedScript].onerror?.()
        context.controller.setActive(false)
        context.controller.setActive(true)
        lateLoad?.()
        context.tcf(accepted)
        context.publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
        expect(context.controller.getSnapshot().scriptFailed).toBe(true)
        expect(context.controller.getSnapshot().enabled).toBe(false)
        expect(context.scripts).toHaveLength(2)
        expect(context.scripts[failedScript].removed).toBe(true)
        expect(context.browser.adsbygoogle).toHaveLength(0)
      }
  })

  test('a working CMP keeps withdrawal accessible when the independent advertising SDK fails', () => {
    const context = makeBrowser()
    context.controller.setActive(true)
    context.scripts[0].onerror?.()
    context.scripts[1].onload?.()
    context.installCmp()
    context.setInitialUsStatus(2)
    context.publish('CONSENT_API_READY')
    context.publish('INITIAL_US_STATES_OPT_OUT_DATA_READY')
    context.tcf(accepted)
    expect(context.controller.getSnapshot().enabled).toBe(false)
    expect(context.controller.getSnapshot().canReopenConsent).toBe(true)
    expect(context.controller.getSnapshot().canOpenUsChoices).toBe(true)
    context.controller.reopenConsent()
    expect(context.getEuReopened()).toBe(1)
    context.controller.openUsChoices()
    context.resolveUsChoice(true)
    expect(context.controller.getSnapshot().canOpenUsChoices).toBe(false)
    expect(context.browser.adsbygoogle).toHaveLength(0)
  })

  test('does not add a duplicate or trust an already-present unowned AdSense script', () => {
    const context = makeBrowser('rrih.github.io', true)
    context.controller.setActive(true)
    expect(context.scripts).toHaveLength(0)
    expect(context.controller.getSnapshot().scriptFailed).toBe(true)
  })
})
