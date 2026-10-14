// Independent oracle copied from ef25889c60f099aa864bed11042f4054827a78c4:atlas/src/locales.ts.
// Only the TypeScript argument annotation was removed; no normalization rule changed.
export const sourceRevision = 'ef25889c60f099aa864bed11042f4054827a78c4'
export const sourceSha256 = 'c5ce204f45d98a1185983f19f5996735eb90681095f3b14bcb5118593c74a47d'

export function normalizeSearch(value) {
  const zeroes = [0x660, 0x6f0, 0x966, 0x9e6, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xed0]
  return value
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ァ-ヶ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0x60))
    .replace(/\p{Nd}/gu, (character) => {
      const point = character.codePointAt(0) || 0
      const zero = zeroes.find((start) => point >= start && point <= start + 9)
      return zero === undefined ? character : String(point - zero)
    })
    .toLowerCase()
    .trim()
}
