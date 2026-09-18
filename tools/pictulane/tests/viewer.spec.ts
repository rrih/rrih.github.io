import { test, expect } from '@playwright/test'
const base = '/tools/pictulane/'
test.beforeEach(async ({ context }) => {
  await context.route('https://pbs.twimg.com/media/PICTULANE_TEST_*', (route) => {
    const portrait = route.request().url().includes('A1')
    const width = portrait ? 700 : 1200,
      height = portrait ? 1100 : 700
    const key =
      route
        .request()
        .url()
        .match(/TEST_(\w+)/)?.[1] || 'test'
    const body = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#526d66"/><circle cx="${width * 0.65}" cy="${height * 0.35}" r="160" fill="#d9ddbb"/><path d="M0 ${height * 0.7}L${width * 0.4} ${height * 0.4}L${width} ${height * 0.8}V${height}H0Z" fill="#273d37"/><text x="40" y="70" font-family="sans-serif" font-size="35" fill="white">TEST ONLY · ${key}</text></svg>`
    return route.fulfill({
      body,
      contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' },
    })
  })
})
test('cross-post keyboard, 200 navigation steps, history and focus', async ({ page }) => {
  await page.goto(base + '#/nasa')
  await expect(page.locator('.thumb')).toHaveCount(6)
  await page.locator('.thumb').nth(2).click()
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A3$/)
  const history = await page.evaluate(() => window.history.length)
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /B1$/)
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A3$/)
  const timings = []
  for (let i = 0; i < 202; i++) {
    const start = Date.now()
    await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
    await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', i % 2 ? /A3$/ : /B1$/)
    timings.push(Date.now() - start)
  }
  expect(await page.evaluate(() => window.history.length)).toBe(history)
  console.log(
    'DOM + Playwright roundtrip p95 ms',
    timings.sort((a, b) => a - b)[Math.floor(timings.length * 0.95)],
  )
  await page.goBack()
  await expect(page.locator('.thumb').nth(2)).toBeFocused()
  await expect(page.locator('.viewer')).toHaveCount(0)
})
test('deep link fresh context, no substitution, account switching', async ({ page }) => {
  await page.goto(base + '#/nasa/status/900000000000000002/media/B1')
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /B1$/)
  await page.getByRole('button', { name: '閉じる', exact: true }).first().click()
  await expect(page).toHaveURL(/#\/nasa$/)
  await page.goto(base + '#/nasa/status/111/media/missing')
  await expect(page.locator('.unresolved')).toContainText('復元できません')
  await expect(page.locator('.main-image')).toHaveCount(0)
  await page.goto(base + '#/slow')
  await page.locator('#account').fill('fast')
  await page.locator('form button').click()
  await expect(page.locator('h1')).toHaveText('@fast')
  await page.waitForTimeout(1000)
  await expect(page.locator('h1')).toHaveText('@fast')
})
test('swipe intent and input keys', async ({ page }) => {
  await page.goto(base + '#/nasa')
  await page.locator('.thumb').first().click()
  async function swipe(dx: number, dy: number, multi = false) {
    await page.locator('.stage').dispatchEvent('pointerdown', {
      pointerType: 'touch',
      pointerId: 1,
      isPrimary: true,
      clientX: 180,
      clientY: 200,
    })
    if (multi)
      await page.locator('.stage').dispatchEvent('pointerdown', {
        pointerType: 'touch',
        pointerId: 2,
        isPrimary: false,
        clientX: 190,
        clientY: 200,
      })
    await page.locator('.stage').dispatchEvent('pointerup', {
      pointerType: 'touch',
      pointerId: 1,
      isPrimary: true,
      clientX: 180 + dx,
      clientY: 200 + dy,
    })
  }
  await swipe(-100, 80)
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A1$/)
  await swipe(-100, 0, true)
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A1$/)
  await swipe(-100, 0)
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A2$/)
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /B1$/)
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A1$/)
  await page.keyboard.press('Escape')
  await page.locator('#account').fill('nasa')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.viewer')).toHaveCount(0)
})
test('PWA scopes, offline shell, storage and cache non-interference', async ({ page, context }) => {
  await page.goto(base + '#/nasa')
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/tools/other/sw.js', { scope: '/tools/other/' })
    localStorage.setItem('atlas:sentinel', 'keep')
    localStorage.setItem('other:sentinel', 'keep')
    const c = await caches.open('atlas-test')
    await c.put('/sentinel', new Response('keep'))
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toContain(base + 'sw.js')
  expect(
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration()
      return new URL(r!.scope).pathname
    }),
  ).toBe(base)
  await page.getByRole('button', { name: '設定', exact: true }).click()
  await page.getByRole('button', { name: '画像キャッシュを削除', exact: true }).click()
  await page.getByRole('button', { name: '閲覧履歴を削除', exact: true }).click()
  expect(
    await page.evaluate(async () => [
      localStorage.getItem('atlas:sentinel'),
      localStorage.getItem('other:sentinel'),
      await (await (await caches.open('atlas-test')).match('/sentinel'))!.text(),
    ]),
  ).toEqual(['keep', 'keep', 'keep'])
  await page.getByRole('button', { name: '閉じる', exact: true }).click()
  expect(
    await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/tools/other/'))),
  ).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.brand')).toContainText('pictulane')
  await expect(page.locator('.banner').first()).toContainText('オフライン')
})
for (const width of [320, 375, 390, 1440])
  test(`layout ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 })
    await page.goto(base)
    await expect(page.locator('h1')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/top-${width}.png`, fullPage: true })
    await page.goto(base + '#/nasa')
    await page.locator('.thumb').first().click()
    await expect(page.locator('.main-image')).toBeVisible()
    await page.screenshot({ path: `test-results/viewer-${width}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
test('TTL, readable/opaque bounds, failed-cache eviction and namespace', async ({ page }) => {
  await page.goto(base)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const result = await page.evaluate(async () => {
    const send = (type: string, data = {}) =>
      new Promise<Record<string, number>>((resolve) => {
        const c = new MessageChannel()
        c.port1.onmessage = (e) => resolve(e.data)
        navigator.serviceWorker.controller!.postMessage({ type, ...data }, [c.port2])
      })
    const c = await caches.open('pictulane-images-v1'),
      m = await caches.open('pictulane-image-meta-v1')
    const now = Date.now()
    for (let i = 0; i < 115; i++) {
      const url = `https://pbs.twimg.com/media/test_${i}?name=small`
      await c.put(url, new Response('test'))
      await m.put(url, new Response(JSON.stringify({ saved: now, used: now + i, opaque: false })))
    }
    await c.put('https://pbs.twimg.com/media/expired', new Response('old'))
    await m.put(
      'https://pbs.twimg.com/media/expired',
      new Response(JSON.stringify({ saved: 0, used: 0, opaque: false })),
    )
    const stats = await send('stats')
    const expired = !!(await c.match('https://pbs.twimg.com/media/expired'))
    await send('invalidate', { url: 'https://pbs.twimg.com/media/test_114?name=small' })
    const removed = !(await c.match('https://pbs.twimg.com/media/test_114?name=small'))
    return { count: stats.count, expired, removed }
  })
  expect(result).toEqual({ count: 100, expired: false, removed: true })
})
test('corrupt storage and storage denied still allow viewing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pictulane:v1:recent', '{')
    localStorage.setItem('pictulane:v1:settings', 'null')
    Object.defineProperty(Storage.prototype, 'setItem', {
      value() {
        throw new DOMException('full', 'QuotaExceededError')
      },
    })
  })
  await page.goto(base + '#/nasa')
  await expect(page.locator('.thumb')).toHaveCount(6)
  await page.locator('.thumb').first().click()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A2$/)
})
test('real browser opaque responses bounded to ten, offline image reuse and cache toggle', async ({
  page,
  context,
}) => {
  await page.goto(base)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const count = await page.evaluate(async () => {
    const r = await fetch('https://pbs.twimg.com/media/PICTULANE_TEST_opaque', { mode: 'no-cors' })
    if (r.type !== 'opaque') throw Error(`Expected opaque: ${r.type}`)
    const c = await caches.open('pictulane-images-v1'),
      m = await caches.open('pictulane-image-meta-v1')
    for (let i = 0; i < 13; i++) {
      const url = `https://pbs.twimg.com/media/opaque_${i}`
      await c.put(url, r.clone())
      await m.put(
        url,
        new Response(JSON.stringify({ saved: Date.now(), used: Date.now() + i, opaque: true })),
      )
    }
    await new Promise((resolve) => {
      const ch = new MessageChannel()
      ch.port1.onmessage = resolve
      navigator.serviceWorker.controller!.postMessage({ type: 'stats' }, [ch.port2])
    })
    return (await c.keys()).filter((r) => r.url.includes('/opaque_')).length
  })
  expect(count).toBe(10)
  await page.goto(base + '#/nasa')
  await page.locator('.thumb').first().click()
  await expect
    .poll(() =>
      page.locator('.main-image').evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
    )
    .toBe(true)
  await page.waitForTimeout(450)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A1$/)
  await expect
    .poll(() =>
      page.locator('.main-image').evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
    )
    .toBe(true)
  await context.setOffline(false)
  await page.getByRole('button', { name: '設定', exact: true }).last().click()
  await page.locator('dialog input[type=checkbox]').uncheck()
  await page.getByRole('button', { name: '画像キャッシュを削除', exact: true }).click()
  await expect(page.locator('dialog')).toContainText('キャッシュ済み画像: 0')
})
test('decoded image UI timing, long text and failed image remain navigable', async ({ page }) => {
  await page.goto(base + '#/nasa')
  await page.locator('.thumb').first().click()
  await expect
    .poll(() =>
      page.locator('.main-image').evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
    )
    .toBe(true)
  await page.keyboard.press('ArrowRight')
  await expect
    .poll(() =>
      page.locator('.main-image').evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0),
    )
    .toBe(true)
  const timings = await page.evaluate(async () => {
    const a = []
    for (let i = 0; i < 40; i++) {
      const start = performance.now()
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: i % 2 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }),
      )
      await new Promise(requestAnimationFrame)
      await new Promise(requestAnimationFrame)
      if (
        !document
          .querySelector('.main-image')
          ?.getAttribute('data-image-id')
          ?.endsWith(i % 2 ? 'A2' : 'A1')
      )
        throw Error('No visual transition')
      a.push(performance.now() - start)
    }
    return a.sort((a, b) => a - b)
  })
  console.log('Synthetic warm-image event-to-two-rAF p95 ms', timings[38])
  expect(timings[38]).toBeLessThan(100)
  await page.locator('.post-details summary').click()
  await expect(page.locator('.post-details')).toContainText('Long text')
  await expect(page.getByRole('button', { name: '閉じる', exact: true }).first()).toBeInViewport()
  await page.locator('.main-image').dispatchEvent('error')
  await expect(page.locator('.image-state')).toContainText('読み込めません')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A3$/)
})
test('PWA update waits, retains other caches and keeps a second tab in place', async ({ page, context }) => {
  const { readFile, writeFile } = await import('node:fs/promises')
  const original = await readFile('dist/sw.js', 'utf8')
  await page.goto(base + '#/nasa')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.locator('.thumb').nth(1).click()
  const second = await context.newPage()
  await second.goto(base + '#/nasa/status/900000000000000002/media/B1')
  await expect(second.locator('.main-image')).toHaveAttribute('data-image-id', /B1$/)
  await page.evaluate(async () => {
    localStorage.setItem('other:sentinel', 'keep')
    await (await caches.open('other-sentinel')).put('/other', new Response('keep'))
  })
  try {
    await writeFile('dist/sw.js', original.replace(/pictulane-shell-[\da-f]+/, 'pictulane-shell-update-test'))
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration()
      await r!.update()
    })
    await expect
      .poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting))
      .toBe(true)
    await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', /A2$/)
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration()
      r!.waiting!.postMessage({ type: 'activate' })
    })
    await expect
      .poll(() => page.evaluate(async () => !(await navigator.serviceWorker.getRegistration())?.waiting))
      .toBe(true)
    await expect(second.locator('.main-image')).toHaveAttribute('data-image-id', /B1$/)
    expect(
      await page.evaluate(async () => [
        localStorage.getItem('other:sentinel'),
        await (await (await caches.open('other-sentinel')).match('/other'))!.text(),
      ]),
    ).toEqual(['keep', 'keep'])
  } finally {
    await writeFile('dist/sw.js', original)
    await second.close()
  }
})
test('entire sequence forward and reverse, end range and settings Escape', async ({ page }) => {
  await page.goto(base + '#/nasa')
  await page.locator('.thumb').first().click()
  for (const key of ['A2', 'A3', 'B1', 'D1', 'D2']) {
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', new RegExp(`${key}$`))
  }
  await expect(page.locator('.range')).toContainText('範囲の末尾')
  for (const key of ['D1', 'B1', 'A3', 'A2', 'A1']) {
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.main-image')).toHaveAttribute('data-image-id', new RegExp(`${key}$`))
  }
  await page.getByRole('button', { name: '設定', exact: true }).last().click()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog')).not.toBeVisible()
  await expect(page.locator('.viewer')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.viewer')).toHaveCount(0)
})
test('clearing history cancels pending resume writes and disabled cache survives metadata eviction', async ({
  page,
}) => {
  await page.goto(base + '#/nasa')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.locator('.thumb').first().click()
  await page.getByRole('button', { name: '設定', exact: true }).last().click()
  await page.locator('dialog input[type=checkbox]').uncheck()
  await page.getByRole('button', { name: '閲覧履歴を削除', exact: true }).click()
  await page.waitForTimeout(500)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  expect(await page.evaluate(() => localStorage.getItem('pictulane:v1:resume:nasa'))).toBe(null)
  await page.evaluate(() => caches.delete('pictulane-image-meta-v1'))
  await page.goto(base)
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const r = await (await caches.open('pictulane-image-meta-v1')).match(
          location.origin + '/tools/pictulane/__cache_settings',
        )
        return r && (await r.json()).enabled
      }),
    )
    .toBe(false)
})
