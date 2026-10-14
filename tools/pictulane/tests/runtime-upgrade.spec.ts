import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { base, releaseFromDist, releaseServer } from './runtime-fixture'

async function installUpdate(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const registration = (await navigator.serviceWorker.getRegistration())!
    const completed = new Promise<string>(resolve => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing!
        const check = () => {
          if (worker.state === 'installed' || worker.state === 'redundant') resolve(worker.state)
        }
        worker.addEventListener('statechange', check)
        check()
      }, { once: true })
    })
    await registration.update()
    return completed
  })
}

async function shellSnapshot(page: Page, shell: string, wasm: string) {
  return page.evaluate(async ({ shell, wasm }) => {
    const cache = await caches.open(shell)
    const root = await cache.match('/tools/pictulane/')
    const module = await cache.match(wasm)
    const marker = await cache.match('/tools/pictulane/__shell_activation')
    return {
      root: root ? await root.text() : null,
      wasm: module ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', await module.arrayBuffer()))] : null,
      marker: marker ? await marker.json() : null,
    }
  }, { shell, wasm })
}

test('uncontrolled upgrade keeps each ABI pair together with a warm HTTP cache', async ({ browser }) => {
  const previous = await releaseFromDist('a')
  const next = await releaseFromDist('b')
  const server = await releaseServer(previous)
  const context = await browser.newContext({ serviceWorkers: 'block' })
  try {
    const oldPage = await context.newPage()
    await oldPage.goto(server.origin + base)
    await expect(oldPage.locator('.brand')).toHaveText('pictulane')
    expect(await oldPage.evaluate(() => navigator.serviceWorker.controller)).toBeNull()
    // Verify the old JS/WASM are in the HTTP cache without allowing a network
    // fallback. No route interception is installed in this test/context.
    const oldRuntime = [previous.bootstrap, previous.appJs, previous.appWasm]
    const count = server.requests.filter(path => oldRuntime.includes(path)).length
    const cached = await oldPage.evaluate(async paths => Promise.all(paths.map(async path => {
      const response = await fetch(path, { cache: 'only-if-cached', mode: 'same-origin' })
      await response.arrayBuffer()
      return response.status
    })), oldRuntime)
    expect(cached).toEqual([200, 200, 200])
    expect(server.requests.filter(path => oldRuntime.includes(path))).toHaveLength(count)

    server.setRelease(next)
    const fresh = await context.newPage()
    const errors: string[] = []
    const requested: string[] = []
    fresh.on('pageerror', error => errors.push(error.message))
    fresh.on('request', request => requested.push(new URL(request.url()).pathname))
    await fresh.goto(server.origin + base)
    await expect(fresh.locator('.brand')).toHaveText('pictulane')
    expect(errors).toEqual([])
    expect(requested).toEqual(expect.arrayContaining([next.bootstrap, next.appJs, next.appWasm]))
    for (const path of [previous.bootstrap, previous.appJs, previous.appWasm]) expect(requested).not.toContain(path)
  } finally {
    await context.close()
    await server.close()
  }
})

for (const intermediate of ['none', 'failed', 'waiting', 'legacy'] as const) {
  const title = {
    none: 'activation between old JS and WASM reads the same pair from the retained own shell',
    failed: 'failed same-shell and intermediate installs preserve the active ABI through a later activation',
    waiting: 'a superseded waiting worker cannot evict the active page ABI during activation',
    legacy: 'a complete legacy shell without an activation marker remains available during activation',
  }[intermediate]
  test(title, async ({ browser }) => {
    const previous = await releaseFromDist('a')
    const middle = intermediate === 'failed' || intermediate === 'waiting' ? await releaseFromDist('b') : undefined
    const next = await releaseFromDist(middle ? 'c' : 'b')
    const server = await releaseServer(previous)
    const context = await browser.newContext()
    try {
      const current = await context.newPage()
      await current.goto(server.origin + base)
      await current.evaluate(() => navigator.serviceWorker.ready)
      await current.reload()
      await expect(current.locator('.brand')).toHaveText('pictulane')
      await expect.poll(() => current.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
      await expect.poll(() => current.evaluate(async () =>
        (await navigator.serviceWorker.getRegistration())?.active?.state)).toBe('activated')
      if (intermediate === 'legacy') {
        // Old workers have complete shells without an activation marker. Keep
        // that compatibility branch explicit; this is not an old-app UI test.
        await current.evaluate(async shell => {
          await (await caches.open(shell)).delete('/tools/pictulane/__shell_activation')
        }, previous.shell)
        const legacy = await shellSnapshot(current, previous.shell, previous.appWasm)
        expect(legacy.marker).toBeNull()
        expect(legacy.root).not.toBeNull()
        expect(legacy.wasm).toHaveLength(32)
      }
      // An unrelated cache deliberately holds the incompatible next-generation
      // WASM under the old URL. Fallback must only inspect Pictulane shell caches.
      await current.evaluate(async ({ path, bytes }) => {
        const other = await caches.open('other-abi-sentinel')
        await other.put(path, new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/wasm' } }))
      }, { path: previous.appWasm, bytes: [...next.files.get(next.appWasm.slice(base.length))!] })

      const late = await context.newPage()
      // A page-local promise pauses boot without holding a fetch event on the
      // old worker, which would prevent activation until that fetch completes.
      await late.addInitScript(() => {
        Object.defineProperty(globalThis, '__pictulaneBootGate', {
          value: new Promise<void>(resolve => addEventListener('pictulane-boot-resume', () => resolve(), { once: true })),
        })
      })
      const errors: string[] = []
      const requested: string[] = []
      late.on('pageerror', error => errors.push(error.message))
      late.on('request', request => requested.push(new URL(request.url()).pathname))
      await late.goto(server.origin + base, { waitUntil: 'commit' })
      await expect.poll(() => late.evaluate(() => Reflect.get(globalThis, '__pictulaneBootPaused') === true)).toBe(true)
      expect(requested).toContain(previous.appJs)
      expect(requested).not.toContain(previous.appWasm)

      if (intermediate === 'failed') {
        // A comment-only worker change reuses the active shell. A successful
        // install must preserve its active marker while that worker is waiting.
        const beforeReinstall = await shellSnapshot(current, previous.shell, previous.appWasm)
        expect(beforeReinstall.marker).toMatchObject({ active: true })
        expect(beforeReinstall.root).not.toBeNull()
        expect(beforeReinstall.wasm).toHaveLength(32)
        const sameShell = { ...previous, files: new Map(previous.files) }
        sameShell.files.set('sw.js', Buffer.concat([sameShell.files.get('sw.js')!, Buffer.from('\n// reinstall success')]))
        server.setRelease(sameShell)
        expect(await installUpdate(current)).toBe('installed')
        await expect.poll(() => current.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
        expect(await shellSnapshot(current, previous.shell, previous.appWasm)).toEqual(beforeReinstall)

        // A later failed reinstall must leave both the active marker and the
        // complete cached HTML/WASM bytes unchanged.
        sameShell.files.set('sw.js', Buffer.concat([sameShell.files.get('sw.js')!, Buffer.from('\n// reinstall failure')]))
        sameShell.files.delete(previous.appWasm.slice(base.length))
        server.setRelease(sameShell)
        expect(await installUpdate(current)).toBe('redundant')
        expect(await shellSnapshot(current, previous.shell, previous.appWasm)).toEqual(beforeReinstall)

        const failed = { ...middle!, files: new Map(middle!.files) }
        failed.files.delete(failed.appWasm.slice(base.length))
        server.setRelease(failed)
        expect(await installUpdate(current)).toBe('redundant')
        expect(await current.evaluate(shell => caches.has(shell), failed.shell)).toBe(false)
        // Earlier worker versions could leave this empty cache after a failed
        // install. Retention must not mistake it for the preceding active shell.
        await current.evaluate(async shell => { await caches.open(shell) }, failed.shell)
      } else if (intermediate === 'waiting') {
        server.setRelease(middle!)
        expect(await installUpdate(current)).toBe('installed')
        await expect.poll(() => current.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
        expect(await current.evaluate(async shell => {
          const cache = await caches.open(shell)
          return !!await cache.match('/tools/pictulane/')
        }, middle!.shell)).toBe(true)
      }

      server.setRelease(next)
      expect(await installUpdate(current)).toBe('installed')
      await expect.poll(() => current.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true)
      const changed = late.evaluate(() => new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true })
      }))
      await current.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.waiting!.postMessage({ type: 'activate' }))
      expect(await changed).toBe(true)
      await expect.poll(() => late.evaluate(async () =>
        (await navigator.serviceWorker.getRegistration())?.active?.state)).toBe('activated')
      // Remove the browser HTTP cache after all installations; a network
      // fallback must hit the old URL's 404, not silently reuse old WASM.
      // Cache Storage remains intact, so only the retained own shell can pass.
      const cdp = await context.newCDPSession(late)
      await cdp.send('Network.clearBrowserCache')
      await cdp.detach()
      const requestCount = server.requests.length
      await late.evaluate(() => dispatchEvent(new Event('pictulane-boot-resume')))
      await expect(late.locator('.brand')).toHaveText('pictulane')
      expect(requested).toContain(previous.appWasm)
      expect(requested).not.toContain(next.appWasm)
      expect(server.requests.slice(requestCount)).not.toContain(previous.appWasm)
      expect(errors).toEqual([])
      await late.getByRole('button', { name: '設定', exact: true }).click()
      await expect(late.locator('dialog')).toContainText('キャッシュ済み画像: 0')
      const cachesAfter = await late.evaluate(() => caches.keys())
      expect(cachesAfter).toEqual(expect.arrayContaining([previous.shell, next.shell, 'other-abi-sentinel']))
      if (middle) expect(cachesAfter).not.toContain(middle.shell)
      expect(await late.evaluate(async shell => {
        const marker = await (await caches.open(shell)).match('/tools/pictulane/__shell_activation')
        return (await marker!.json()).active
      }, next.shell)).toBe(true)
      expect(server.requests).toEqual(expect.arrayContaining([next.workerJs, next.workerWasm]))
    } finally {
      await context.close()
      await server.close()
    }
  })
}
