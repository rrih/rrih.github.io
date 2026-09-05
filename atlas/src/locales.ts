import english from './locales/ui/en.json'

export const locales = [
  ['en', 'English', 'English'],
  ['ja', '日本語', 'Japanese'],
  ['ko', '한국어', 'Korean'],
  ['zh-Hans', '简体中文', 'Chinese (Simplified)'],
  ['zh-Hant', '繁體中文', 'Chinese (Traditional)'],
  ['fr', 'Français', 'French'],
  ['de', 'Deutsch', 'German'],
  ['es', 'Español', 'Spanish (Spain)'],
  ['es-419', 'Español latinoamericano', 'Spanish (Latin America)'],
  ['it', 'Italiano', 'Italian'],
  ['pt-BR', 'Português do Brasil', 'Portuguese (Brazil)'],
  ['pt', 'Português', 'Portuguese (Portugal)'],
  ['nl', 'Nederlands', 'Dutch'],
  ['sv', 'Svenska', 'Swedish'],
  ['da', 'Dansk', 'Danish'],
  ['nb', 'Norsk bokmål', 'Norwegian Bokmål'],
  ['fi', 'Suomi', 'Finnish'],
  ['is', 'Íslenska', 'Icelandic'],
  ['pl', 'Polski', 'Polish'],
  ['cs', 'Čeština', 'Czech'],
  ['sk', 'Slovenčina', 'Slovak'],
  ['hu', 'Magyar', 'Hungarian'],
  ['ro', 'Română', 'Romanian'],
  ['bg', 'Български', 'Bulgarian'],
  ['uk', 'Українська', 'Ukrainian'],
  ['ru', 'Русский', 'Russian'],
  ['el', 'Ελληνικά', 'Greek'],
  ['tr', 'Türkçe', 'Turkish'],
  ['ar', 'العربية', 'Arabic'],
  ['he', 'עברית', 'Hebrew'],
  ['fa', 'فارسی', 'Persian'],
  ['ur', 'اردو', 'Urdu'],
  ['hi', 'हिन्दी', 'Hindi'],
  ['bn', 'বাংলা', 'Bengali'],
  ['ta', 'தமிழ்', 'Tamil'],
  ['te', 'తెలుగు', 'Telugu'],
  ['mr', 'मराठी', 'Marathi'],
  ['ne', 'नेपाली', 'Nepali'],
  ['th', 'ไทย', 'Thai'],
  ['vi', 'Tiếng Việt', 'Vietnamese'],
  ['id', 'Bahasa Indonesia', 'Indonesian'],
  ['ms', 'Bahasa Melayu', 'Malay'],
  ['fil', 'Filipino', 'Filipino'],
  ['sw', 'Kiswahili', 'Swahili'],
  ['af', 'Afrikaans', 'Afrikaans'],
  ['ca', 'Català', 'Catalan'],
  ['hr', 'Hrvatski', 'Croatian'],
  ['sr', 'Српски', 'Serbian'],
  ['sl', 'Slovenščina', 'Slovenian'],
] as const
export type Locale = (typeof locales)[number][0]
export type Messages = Record<string, string>
const localeCodes = new Map<string, Locale>(locales.map(([code]) => [code.toLowerCase(), code]))
export const isRTL = (locale: Locale) => ['ar', 'he', 'fa', 'ur'].includes(locale)

export function resolveLocale(value?: string | null): Locale | undefined {
  if (!value) return
  const tag = value.trim().replaceAll('_', '-').toLowerCase()
  const exact = localeCodes.get(tag)
  if (exact) return exact
  const parts = tag.split('-')
  const language = parts[0]
  if (language === 'zh') {
    if (parts.includes('hans')) return 'zh-Hans'
    if (parts.includes('hant')) return 'zh-Hant'
    return parts.some((p) => ['tw', 'hk', 'mo'].includes(p)) ? 'zh-Hant' : 'zh-Hans'
  }
  if (language === 'pt') return parts.includes('br') ? 'pt-BR' : 'pt'
  if (language === 'es')
    return parts.some((p) =>
      [
        '419',
        'mx',
        'ar',
        'bo',
        'cl',
        'co',
        'cr',
        'cu',
        'do',
        'ec',
        'gt',
        'hn',
        'ni',
        'pa',
        'pe',
        'pr',
        'py',
        'sv',
        'uy',
        've',
      ].includes(p),
    )
      ? 'es-419'
      : 'es'
  const aliases: Record<string, Locale> = { no: 'nb', nn: 'nb', tl: 'fil', iw: 'he', in: 'id' }
  return localeCodes.get(language) || aliases[language]
}

export function preferredLocale(
  shared: string | null,
  saved: string | null,
  browser: readonly string[],
): Locale {
  return resolveLocale(shared) || resolveLocale(saved) || browser.map(resolveLocale).find(Boolean) || 'en'
}

export function translator(messages: Messages) {
  return (key: string, values: Record<string, string | number> = {}) =>
    (messages[key] || (english as Messages)[key] || key).replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      values[name] === undefined ? placeholder : String(values[name]),
    )
}

export function normalizeSearch(value: string) {
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
