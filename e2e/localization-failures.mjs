import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const base = process.env.ATLAS_URL || 'http://127.0.0.1:3340'
const output = process.env.ATLAS_QA_DIR || 'work/i18n/failures'
await mkdir(output, { recursive: true })
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const dictionaries = Object.fromEntries(
  await Promise.all(
    ['en', 'fr', 'ja', 'ar'].map(async (locale) => [locale, await readJson(`src/locales/ui/${locale}.json`)]),
  ),
)
const catalogs = Object.fromEntries(
  await Promise.all(
    ['fr', 'ja', 'ja-Hrkt'].map(async (locale) => [
      locale,
      await readJson(`public/locales/catalog/${locale}.json`),
    ]),
  ),
)
const english = (await readJson('src/data/catalog.json')).find((entry) => entry.id === 6)
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader'],
})
const results = []

async function scenario(name, options, run) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    ...options,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)
  page.setDefaultNavigationTimeout(90_000)
  const errors = []
  const failedRequests = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) =>
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText }),
  )
  try {
    const evidence = await run(page, context)
    assert.deepEqual(errors, [], `${name}: no unhandled browser exceptions`)
    results.push({ name, freshContext: true, serviceWorkers: 'blocked', ...evidence, errors })
    await writeFile(
      `${output}/verification.json`,
      JSON.stringify({ base, status: 'running', results }, null, 2),
    )
    console.log(`PASS ${name}`)
  } catch (error) {
    const [screenshot, body] = await Promise.allSettled([
      page.screenshot({ path: `${output}/${name}-failure.png`, fullPage: true, timeout: 10_000 }),
      page.locator('body').innerText({ timeout: 10_000 }),
    ])
    await writeFile(
      `${output}/failure.json`,
      JSON.stringify(
        {
          name,
          url: page.url(),
          error: String(error),
          errors,
          failedRequests,
          screenshot: screenshot.status === 'fulfilled' ? `${name}-failure.png` : String(screenshot.reason),
          body: body.status === 'fulfilled' ? body.value : String(body.reason),
          results,
        },
        null,
        2,
      ),
    )
    throw error
  } finally {
    await context.close()
  }
}

async function state(page, locale, status) {
  await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', locale)
  await expect(page.locator('.app-shell')).toHaveAttribute('data-catalog-state', status, { timeout: 120_000 })
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
  await expect(page.locator('.header nav button').first()).toHaveText(dictionaries[locale].Explore)
  await expect(page.locator('.language-button')).toHaveAttribute(
    'aria-label',
    dictionaries[locale]['Choose your language'],
  )
}

async function englishFallback(page, locale) {
  await state(page, locale, 'failed')
  await expect(page.locator('h1 bdi')).toHaveText(english.name)
  await expect(page.locator('.description')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.description')).toHaveText(english.description)
  await expect(page.locator('.entry-language')).toHaveText(dictionaries[locale]['English entry'])
  await expect(page.locator('.catalog-notice')).toContainText(
    dictionaries[locale]['Translated entries could not be loaded. English entries are ready to explore.'],
  )
  await expect(
    page.getByRole('button', { name: dictionaries[locale]['Retry translations'], exact: true }),
  ).toBeVisible()
}

async function localizedEntry(page, locale, sourceLocale = locale) {
  await state(page, locale, 'ready')
  const entry = catalogs[sourceLocale].species['6']
  await expect(page.locator('h1 bdi')).toHaveText(entry.name)
  await expect(page.locator('.description')).toHaveAttribute('lang', locale)
  await expect(page.locator('.description')).toHaveText(entry.description)
  await expect(page.locator('.entry-language')).toHaveCount(0)
  await expect(page.locator('.catalog-notice')).toHaveCount(0)
}

async function denyStorage(context) {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is unavailable in this test', 'SecurityError')
      },
    })
  })
}

try {
  for (const locale of ['fr', 'ja']) {
    await scenario(`${locale}-failure-and-retry`, {}, async (page) => {
      let blocked = true
      const aborted = []
      const requested = locale === 'ja' ? ['ja', 'ja-Hrkt'] : ['fr']
      for (const code of requested) {
        await page.route(`**/locales/catalog/${code}.json`, async (route) => {
          if (blocked) {
            aborted.push(code)
            await route.abort('failed')
          } else await route.continue()
        })
      }
      await page.goto(`${base}/?lang=${locale}#pokemon=6&scene=studio`)
      await englishFallback(page, locale)
      for (const code of requested) assert(aborted.includes(code), `${code} fetch was actually aborted`)
      await page.screenshot({ path: `${output}/${locale}-fallback.png`, fullPage: true })
      blocked = false
      await page
        .getByRole('button', { name: dictionaries[locale]['Retry translations'], exact: true })
        .click()
      await localizedEntry(page, locale)
      await page.screenshot({ path: `${output}/${locale}-recovered.png`, fullPage: true })
      return {
        abortedCatalogs: [...new Set(aborted)],
        uiTranslatedDuringFailure: true,
        descriptionFallbackLang: 'en',
        englishBadge: true,
        retryRecovered: true,
      }
    })
  }

  for (const blockedLocale of ['ja', 'ja-Hrkt']) {
    await scenario(`japanese-without-${blockedLocale}`, {}, async (page) => {
      let aborted = 0
      await page.route(`**/locales/catalog/${blockedLocale}.json`, async (route) => {
        aborted++
        await route.abort('failed')
      })
      await page.goto(`${base}/?lang=ja#pokemon=6&scene=studio`)
      const sourceLocale = blockedLocale === 'ja' ? 'ja-Hrkt' : 'ja'
      await localizedEntry(page, 'ja', sourceLocale)
      assert(aborted > 0, 'The unavailable Japanese catalog was actually requested and aborted')
      await page.screenshot({ path: `${output}/japanese-without-${blockedLocale}.png`, fullPage: true })
      return {
        abortedCatalog: blockedLocale,
        displayedCatalog: sourceLocale,
        descriptionLang: 'ja',
        noFailureNotice: true,
      }
    })
  }

  await scenario('language-selection-without-storage', {}, async (page, context) => {
    await denyStorage(context)
    await page.goto(`${base}/?lang=en#pokemon=6&scene=studio`)
    await state(page, 'en', 'ready')
    assert(
      await page.evaluate(() => {
        try {
          localStorage.getItem('atlas-language')
          return false
        } catch (error) {
          return error.name === 'SecurityError'
        }
      }),
      'localStorage must actually be inaccessible',
    )
    for (const locale of ['ja', 'fr']) {
      await page.locator('.language-button').click()
      await page.locator(`[data-language="${locale}"]`).click()
      await localizedEntry(page, locale)
      assert.equal(new URL(page.url()).searchParams.get('lang'), locale)
      await page.locator('.language-button').click()
      await expect(page.locator(`[data-language="${locale}"]`)).toHaveAttribute('aria-pressed', 'true')
      await expect(
        page.getByText(dictionaries[locale]['Your language is saved on this device.'], { exact: true }),
      ).toHaveCount(0)
      await page.screenshot({ path: `${output}/storage-unavailable-${locale}.png`, fullPage: true })
      await page.keyboard.press('Escape')
    }
    return {
      storageUnavailable: true,
      selected: ['ja', 'fr'],
      translatedEntries: true,
      sharedUrlUpdated: true,
      falseSavedNotice: false,
    }
  })

  const notFoundCases = [
    { name: '404-browser-fr', browserLocale: 'fr-FR', expected: 'fr' },
    { name: '404-browser-ar', browserLocale: 'ar-EG', expected: 'ar' },
    { name: '404-browser-ja', browserLocale: 'ja-JP', expected: 'ja' },
    { name: '404-saved-preference', browserLocale: 'ar-EG', saved: 'fr', expected: 'fr' },
    { name: '404-url-precedence', browserLocale: 'ja-JP', saved: 'fr', query: 'ar', expected: 'ar' },
    {
      name: '404-invalid-url-fallback',
      browserLocale: 'ja-JP',
      saved: 'fr',
      query: 'xx-invalid',
      expected: 'fr',
    },
    { name: '404-without-storage', browserLocale: 'ar-EG', storageUnavailable: true, expected: 'ar' },
  ]
  for (const test of notFoundCases) {
    await scenario(test.name, { locale: test.browserLocale }, async (page, context) => {
      if (test.saved)
        await context.addInitScript((saved) => localStorage.setItem('atlas-language', saved), test.saved)
      if (test.storageUnavailable) await denyStorage(context)
      const url = new URL('/404.html', base)
      if (test.query) url.searchParams.set('lang', test.query)
      await page.goto(url.href)
      const t = dictionaries[test.expected]
      const direction = test.expected === 'ar' ? 'rtl' : 'ltr'
      await expect(page.locator('html')).toHaveAttribute('lang', test.expected)
      await expect(page.locator('html')).toHaveAttribute('dir', direction)
      await expect(page.locator('h1')).toHaveText(t['Page not found'])
      await expect(page.locator('main p')).toHaveText(
        t['This page has moved. Explore Pokémon Atlas from its new home.'],
      )
      await expect(page.locator('main a')).toHaveText(t['Open Pokémon Atlas'])
      await expect(page.locator('main a')).toHaveAttribute('href', `/?lang=${test.expected}`)
      await expect(page).toHaveTitle(`${t['Page not found']} · Pokémon Atlas`)
      if (test.saved)
        assert.equal(
          await page.evaluate(() => localStorage.getItem('atlas-language')),
          test.saved,
          'URL selection must not replace the saved language',
        )
      await page.screenshot({ path: `${output}/${test.name}.png`, fullPage: true })
      return {
        browserLocale: test.browserLocale,
        saved: test.saved || null,
        query: test.query || null,
        selectedLocale: test.expected,
        direction,
        localizedTitleBodyAndLink: true,
      }
    })
  }
  await writeFile(
    `${output}/verification.json`,
    JSON.stringify({ base, status: 'passed', scenarioCount: results.length, results }, null, 2),
  )
  console.log(`Verified ${results.length} isolated localization failure and 404 scenarios.`)
} finally {
  await browser.close()
}
