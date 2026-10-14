import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { normalizeSearch, sourceRevision, sourceSha256 } from '../test/fixtures/search-normalization-oracle.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(root, process.env.ATLAS_QA_DIR || 'work/rust-renderer-qa')
const pkg = resolve(root, process.env.ATLAS_RENDERER_QA || 'work/rust-renderer-qa/pkg')
const readJson = async path => JSON.parse(await readFile(resolve(root, path), 'utf8'))
const catalogFiles = (await readdir(resolve(root, 'public/locales/catalog'))).filter(path => path.endsWith('.json')).sort()
const [catalog, forms, search, ...translations] = await Promise.all([
  readJson('src/data/catalog.json'), readJson('src/data/forms.json'), readJson('public/locales/search.json'),
  ...catalogFiles.map(file => readJson(`public/locales/catalog/${file}`)),
])
const inputs = new Map(), sourceCounts = {}
function add(value, source) {
  assert.equal(typeof value, 'string', `${source} must be text`)
  sourceCounts[source] = (sourceCounts[source] || 0) + 1
  if (!inputs.has(value)) inputs.set(value, source)
}
function name(value, source) {
  if (value === undefined) return
  add(value, source)
  add(value.normalize('NFD'), 'decomposed-names')
  add(` \t${value.toUpperCase()}\u00a0`, 'upper-case-and-whitespace-names')
}
for (const entry of catalog) {
  for (const key of ['name', 'ja', 'slug']) name(entry[key], 'base-catalog')
  add(String(entry.id), 'species-numbers')
}
for (const form of forms) {
  for (const key of ['name', 'id']) name(form[key], 'forms')
  for (const value of Object.values(form.names || {})) name(value, 'translated-forms')
}
for (const names of Object.values(search)) for (const value of names) name(value, 'search-index')
for (const translation of translations) {
  for (const entry of Object.values(translation.species)) name(entry.name, `catalog-${translation.locale}`)
}
const edges = [
  '', '  \t\r\n ', 'Pokémon', 'POKE\u0301MON', 'Flabébé', 'Farfetch’d', 'Mr. Mime', 'Nidoran♀', 'Type: Null',
  'ピカチュウ', 'ヒ\u309aカチュウ', 'ﾋﾟｶﾁｭｳ', 'ガギグゲゴ', 'カ\u3099キ\u3099ク\u3099ケ\u3099コ\u3099',
  'ヴヷヸヹヺ', 'ァヵヶー', 'ひらがな カタカナ', '㌀ ㍿ ㌕ ㍑', '피카츄 피카츄', '神 神',
  '＃００６', 'Ⓐ K ㎏ ﬁ ㌀ ⑫ １２', '𝔓𝕠𝕜𝕖́𝕞𝕠𝕟 𝟘𝟙𝟚', 'ǅǈǋǲ', 'Straße ß ẞ Ł Œ',
  'İ I ı i', 'I\u0307', 'Σ', 'ΟΣ', 'ΟΣΑ', 'ΑΣ\u0301', 'Σ ΣΑ', 'AΣ\u200c', 'AΣ\u200dA', 'ΣΟΣ ΣΟς',
  'a\u0300\u036f', 'a\u1ab0\u1dc0\u20d0\ufe20', '\u180ePokémon\u200b', '\ufeffPokémon\ufeff',
  '\u0085Pokémon\u0085', '\u2000\u2028\u2029\u202f\u205f\u3000Pokémon\u3000',
  'A\u0000B', '🔎 Pokémon 🧬', '𐐀𐐁𐐨𐐩', '𝟞 ⑥ Ⅵ 六',
]
for (const value of edges) add(value, 'unicode-edge-cases')
const zeroes = [0x660, 0x6f0, 0x966, 0x9e6, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xed0]
for (const zero of zeroes) {
  const digits = Array.from({ length: 10 }, (_, digit) => String.fromCodePoint(zero + digit))
  for (const digit of digits) add(digit, 'twelve-digit-systems')
  add(digits.join(''), 'twelve-digit-systems')
  add(` #${digits[0]}${digits[0]}${digits[6]} Pokémon ${digits.toReversed().join('')} `, 'mixed-digit-systems')
}
// The old contract only remaps the twelve listed decimal ranges. Other decimal
// scripts must remain intact unless NFKC itself converts a compatibility form.
for (const zero of [0x0f20, 0x1040, 0x17e0, 0x1810, 0x1946, 0x1a80, 0x1b50, 0x1c50, 0xa620, 0x11066]) {
  add(Array.from({ length: 10 }, (_, digit) => String.fromCodePoint(zero + digit)).join(''), 'other-decimal-scripts')
}

const { default: init, qa_normalize_search } = await import(pathToFileURL(`${pkg}/atlas_app.js`).href)
await init({ module_or_path: await readFile(`${pkg}/atlas_app_bg.wasm`) })
assert.equal(typeof qa_normalize_search, 'function', 'Rebuild the renderer-qa WASM before running normalization parity')
const fingerprint = createHash('sha256')
let checked = 0
for (const [value, source] of inputs) {
  const expected = normalizeSearch(value)
  assert.equal(qa_normalize_search(value), expected, `${source}: ${JSON.stringify(value)}`)
  fingerprint.update(JSON.stringify([value, expected]) + '\n')
  checked++
}
await mkdir(output, { recursive: true })
await writeFile(`${output}/search-normalization.json`, JSON.stringify({
  passed: true, sourceRevision, sourceSha256, node: process.version, checked,
  catalogSpecies: catalog.length, forms: forms.length, catalogFiles, digitSystems: zeroes.length,
  sourceCounts, oracleFingerprint: fingerprint.digest('hex'),
}, null, 2))
console.log(`${checked} WASM search normalization inputs exactly match the original JavaScript oracle, including all catalog/search names and 12 decimal digit systems.`)
