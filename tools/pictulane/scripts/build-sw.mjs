import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
const files = readdirSync('dist', { recursive: true }).filter(
  (x) => /\.(html|js|css|png|svg|webmanifest)$/.test(x) && x !== 'sw.js',
)
const hash = createHash('sha256')
for (const f of files.sort()) hash.update(readFileSync(`dist/${f}`))
hash.update(readFileSync('public/sw.js'))
const assets = ['/tools/pictulane/', ...files.map((f) => `/tools/pictulane/${f}`)]
writeFileSync(
  'dist/sw.js',
  readFileSync('public/sw.js', 'utf8')
    .replace('__BUILD__', hash.digest('hex').slice(0, 12))
    .replace('__ASSETS__', JSON.stringify(assets)),
)
// A test build cannot silently be deployed as production.
if (process.env.PICTULANE_TEST_BUILD === '1') writeFileSync('dist/TEST-ONLY', 'Do not deploy')
