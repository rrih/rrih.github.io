import { test, expect } from '@playwright/test'

test('Rust worker restarts offline with its version-matched WASM shell', async ({ page, context }) => {
  const base = '/tools/pictulane/'
  await page.goto(base)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  const cdp = await context.newCDPSession(page)
  await cdp.send('ServiceWorker.enable')
  await context.setOffline(true)
  await cdp.send('ServiceWorker.stopAllWorkers')
  await page.reload()
  await expect(page.locator('.brand')).toHaveText('pictulane')
  await expect(page.locator('.banner').first()).toContainText('オフライン')
  await page.getByRole('button', { name: '設定', exact: true }).click()
  await expect(page.locator('dialog')).toContainText('キャッシュ済み画像: 0')
  expect(await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('pictulane-shell-'))
    const shell = await caches.open(names[0])
    const modules = (await shell.keys()).filter(request =>
      /\/tools\/pictulane\/worker-[a-f0-9]{20}\/pictulane_worker_bg\.wasm$/.test(new URL(request.url).pathname))
    if (modules.length !== 1) return false
    const response = await shell.match(modules[0])
    const magic = new Uint8Array(await response!.arrayBuffer()).slice(0, 4)
    return [...magic].join(',') === '0,97,115,109'
  })).toBe(true)
})
