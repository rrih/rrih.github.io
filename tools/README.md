# Independent tools

Each app lives in `tools/<app>/` with its own package manifest, lockfile, source, tests, public assets and README. It must build without importing another app's source or outputs.

- Set the base, manifest id/start_url/scope and worker scope to `/tools/<app>/`. Use hash routes for dynamic state; keep the site's real 404.
- Build each app first, then compose finished artifacts using `deployment/compose.ts`. Profile and Atlas builds may delete their own `dist`; never run those builds after composition. One complete `site-dist` goes to one Pages deployment.
- Add the app's isolated CI job and artifact to the existing assemble job. Do not deploy an app alone over the site. Current composition: `bun deployment/compose.ts dist atlas/dist atlas/hosting site-dist tools/pictulane/dist`.
- Use `<app>:` for localStorage and `<app>-` for Cache Storage. Clear only keys/caches owned by the app. No root or `/tools/` service worker. Keep Atlas's keys and worker.
- Share an origin, not a runtime. Namespaces prevent accidental collisions; they are not a security boundary.
- Test fixtures, sources, credentials and development files must not enter deployment artifacts.
