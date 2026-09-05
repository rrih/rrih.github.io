import {
  type AtlasPage,
  assetPath,
  atlasPath,
  canonicalUrl,
  SEO_LOCALES,
  type SeoLocale,
  SITE_ORIGIN,
  seoLocale,
} from './routes'

const words = {
  en: {
    home: '3D Pokémon viewer',
    catalog: 'Pokédex',
    models: '3D model, forms and stats',
    generation: 'Generation',
    types: 'Type',
    forms: 'Pokémon forms',
    mega: 'Mega Evolutions',
    regional: 'Regional forms',
    help: 'Help',
    about: 'About & contact',
    page: 'Page',
    open: 'Explore animated Pokémon models, shiny appearances and forms. Rotate the view, choose a landscape and save a scene with up to six Pokémon.',
    details: 'Explore the 3D model, available forms, types and base stats.',
    index: 'Browse Pokémon and open their animated 3D models, forms and base stats.',
    standard: 'Standard form',
  },
  ja: {
    home: 'ポケモン3D図鑑',
    catalog: 'ポケモン図鑑',
    models: '3Dモデル・フォルム・種族値',
    generation: '世代',
    types: 'タイプ',
    forms: 'ポケモンのフォルム',
    mega: 'メガシンカ',
    regional: 'リージョンフォーム',
    help: '使い方',
    about: '運営・お問い合わせ',
    page: 'ページ',
    open: 'ポケモンの3Dモデル、色違い、フォルムを閲覧。角度や風景を変えて、最大6匹を配置したシーンを端末に保存できます。',
    details: '3Dモデル、収録フォルム、タイプ、種族値を確認できます。',
    index: 'ポケモンを一覧から選び、3Dモデルやフォルム、種族値を確認できます。',
    standard: '通常のすがた',
  },
  fr: {
    home: 'Pokédex 3D',
    catalog: 'Pokédex',
    models: 'modèle 3D, formes et statistiques',
    generation: 'Génération',
    types: 'Type',
    forms: 'Formes des Pokémon',
    mega: 'Méga-Évolutions',
    regional: 'Formes régionales',
    help: 'Aide',
    about: 'À propos et contact',
    page: 'Page',
    open: 'Explorez les modèles 3D animés, les apparences chromatiques et les formes des Pokémon. Choisissez un paysage et enregistrez une scène avec jusqu’à six Pokémon.',
    details: 'Découvrez le modèle 3D, les formes disponibles, les types et les statistiques de base.',
    index:
      'Parcourez les Pokémon et découvrez leurs modèles 3D animés, leurs formes et leurs statistiques de base.',
    standard: 'Forme standard',
  },
  de: {
    home: '3D-Pokédex',
    catalog: 'Pokédex',
    models: '3D-Modell, Formen und Basiswerte',
    generation: 'Generation',
    types: 'Typ',
    forms: 'Pokémon-Formen',
    mega: 'Mega-Entwicklungen',
    regional: 'Regionalformen',
    help: 'Hilfe',
    about: 'Über uns und Kontakt',
    page: 'Seite',
    open: 'Entdecke animierte 3D-Modelle, schillernde Pokémon und verschiedene Formen. Wähle eine Landschaft und speichere eine Szene mit bis zu sechs Pokémon.',
    details: 'Entdecke das 3D-Modell, verfügbare Formen, Typen und Basiswerte.',
    index: 'Wähle Pokémon aus und entdecke ihre animierten 3D-Modelle, Formen und Basiswerte.',
    standard: 'Standardform',
  },
  es: {
    home: 'Pokédex 3D',
    catalog: 'Pokédex',
    models: 'modelo 3D, formas y estadísticas',
    generation: 'Generación',
    types: 'Tipo',
    forms: 'Formas de Pokémon',
    mega: 'Megaevoluciones',
    regional: 'Formas regionales',
    help: 'Ayuda',
    about: 'Acerca de y contacto',
    page: 'Página',
    open: 'Explora modelos 3D animados, Pokémon variocolor y distintas formas. Elige un paisaje y guarda una escena con hasta seis Pokémon.',
    details: 'Consulta el modelo 3D, las formas disponibles, los tipos y las estadísticas base.',
    index: 'Explora los Pokémon y abre sus modelos 3D animados, formas y estadísticas base.',
    standard: 'Forma estándar',
  },
  it: {
    home: 'Pokédex 3D',
    catalog: 'Pokédex',
    models: 'modello 3D, forme e statistiche',
    generation: 'Generazione',
    types: 'Tipo',
    forms: 'Forme dei Pokémon',
    mega: 'Megaevoluzioni',
    regional: 'Forme regionali',
    help: 'Guida',
    about: 'Informazioni e contatti',
    page: 'Pagina',
    open: 'Esplora modelli 3D animati, Pokémon cromatici e forme diverse. Scegli un paesaggio e salva una scena con un massimo di sei Pokémon.',
    details: 'Scopri il modello 3D, le forme disponibili, i tipi e le statistiche di base.',
    index: 'Sfoglia i Pokémon e scopri i loro modelli 3D animati, le forme e le statistiche di base.',
    standard: 'Forma standard',
  },
  ko: {
    home: '포켓몬 3D 도감',
    catalog: '포켓몬 도감',
    models: '3D 모델·폼·종족값',
    generation: '세대',
    types: '타입',
    forms: '포켓몬 폼',
    mega: '메가진화',
    regional: '리전폼',
    help: '사용 방법',
    about: '운영 및 문의',
    page: '페이지',
    open: '포켓몬의 움직이는 3D 모델과 색이 다른 모습, 다양한 폼을 살펴보세요. 풍경을 고르고 최대 6마리를 배치한 장면을 기기에 저장할 수 있습니다.',
    details: '3D 모델, 제공되는 폼, 타입과 종족값을 확인하세요.',
    index: '포켓몬 목록에서 움직이는 3D 모델과 폼, 종족값을 확인하세요.',
    standard: '일반 모습',
  },
  'zh-Hans': {
    home: '宝可梦3D图鉴',
    catalog: '宝可梦图鉴',
    models: '3D模型、形态与种族值',
    generation: '世代',
    types: '属性',
    forms: '宝可梦形态',
    mega: '超级进化',
    regional: '地区形态',
    help: '使用方法',
    about: '关于与联系',
    page: '页',
    open: '查看宝可梦的动态3D模型、异色与不同形态。选择风景，摆放最多6只宝可梦，并将场景保存在设备上。',
    details: '查看3D模型、收录形态、属性与种族值。',
    index: '从列表中选择宝可梦，查看动态3D模型、形态与种族值。',
    standard: '普通形态',
  },
  'zh-Hant': {
    home: '寶可夢3D圖鑑',
    catalog: '寶可夢圖鑑',
    models: '3D模型、形態與種族值',
    generation: '世代',
    types: '屬性',
    forms: '寶可夢形態',
    mega: '超級進化',
    regional: '地區形態',
    help: '使用方法',
    about: '關於與聯絡',
    page: '頁',
    open: '查看寶可夢的動態3D模型、異色與不同形態。選擇風景，擺放最多6隻寶可夢，並將場景儲存在裝置上。',
    details: '查看3D模型、收錄形態、屬性與種族值。',
    index: '從列表中選擇寶可夢，查看動態3D模型、形態與種族值。',
    standard: '一般形態',
  },
} as const
export const seoWords = (locale: string) => words[seoLocale(locale)]
export interface Breadcrumb {
  name: string
  href: string
}
export interface PageSeo {
  language: SeoLocale
  title: string
  description: string
  canonical: string
  alternates: { lang: string; href: string }[]
  ogLocale: string
  image: string
  imageAlt: string
  primaryImage?: string
  breadcrumbs: Breadcrumb[]
  jsonLd: Record<string, unknown>
}
const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : SITE_ORIGIN + assetPath(path))

function pageSeo(
  page: AtlasPage,
  locale: string,
  title: string,
  description: string,
  breadcrumbs: Breadcrumb[],
  image?: string,
  primaryImage?: string,
): PageSeo {
  const language = seoLocale(locale)
  const canonical = canonicalUrl(page, language)
  const localizedPages = page.kind === 'help' || page.kind === 'about' ? ['en', 'ja'] : SEO_LOCALES
  const alternates = [
    ...localizedPages.map((lang) => ({ lang, href: canonicalUrl(page, lang) })),
    { lang: 'x-default', href: canonicalUrl(page, 'en') },
  ]
  const pageData: Record<string, unknown> = {
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    name: title,
    description,
    url: canonical,
    inLanguage: language,
    isPartOf: {
      '@type': 'WebApplication',
      '@id': `${SITE_ORIGIN}${atlasPath({ kind: 'home' })}#app`,
      name: 'Pokémon Atlas',
      url: canonicalUrl({ kind: 'home' }),
    },
    ...(primaryImage ? { primaryImageOfPage: { '@type': 'ImageObject', url: absolute(primaryImage) } } : {}),
  }
  const graph: Record<string, unknown>[] = [pageData]
  if (breadcrumbs.length > 1) {
    pageData.breadcrumb = { '@id': `${canonical}#breadcrumb` }
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: SITE_ORIGIN + crumb.href,
      })),
    })
  }
  if (page.kind === 'home')
    graph.push({
      '@type': 'WebApplication',
      '@id': `${canonicalUrl({ kind: 'home' })}#app`,
      name: 'Pokémon Atlas',
      url: canonicalUrl({ kind: 'home' }),
      applicationCategory: 'EntertainmentApplication',
      operatingSystem: 'Web browser',
      description,
      inLanguage: [...SEO_LOCALES],
      isAccessibleForFree: true,
      browserRequirements: 'WebGL 2 or WebGPU',
      softwareHelp: canonicalUrl({ kind: 'help' }, language),
    })
  return {
    language,
    title,
    description,
    canonical,
    alternates,
    ogLocale: {
      en: 'en_US',
      ja: 'ja_JP',
      fr: 'fr_FR',
      de: 'de_DE',
      es: 'es_ES',
      it: 'it_IT',
      ko: 'ko_KR',
      'zh-Hans': 'zh_CN',
      'zh-Hant': 'zh_TW',
    }[language],
    image: absolute(image || '/social-atlas.jpg'),
    imageAlt: title,
    ...(primaryImage ? { primaryImage: absolute(primaryImage) } : {}),
    breadcrumbs,
    jsonLd: { '@context': 'https://schema.org', '@graph': graph },
  }
}

export interface PokemonSeoInput {
  pokemon: { id: number; name: string; height: number; weight: number; types: string[] }
  localized: { name: string; description?: string }
  locale: string
  form?: { id: string; name?: string }
  baseName?: string
  typeNames?: string[]
  image?: string
  ogImage?: string
}
export function buildPokemonSeo(input: PokemonSeoInput): PageSeo {
  const { pokemon, localized, locale, form } = input
  const language = seoLocale(locale),
    text = seoWords(language)
  const translatedContent = SEO_LOCALES.some((candidate) => candidate === locale) || locale === 'es-419'
  const name = translatedContent ? localized.name : form?.name || pokemon.name
  const types =
    language !== 'en' && translatedContent && input.typeNames
      ? input.typeNames
      : pokemon.types.map((type) => type[0].toUpperCase() + type.slice(1))
  const page: AtlasPage = { kind: 'pokemon', id: pokemon.id, ...(form ? { formId: form.id } : {}) }
  const number = String(pokemon.id).padStart(4, '0')
  const title = `${name} (No.${number}) · ${text.models} | Pokémon Atlas`
  const description = `${name} · ${types.join(' / ')} · ${pokemon.height} m · ${pokemon.weight} kg. ${text.details}`
  const crumbs: Breadcrumb[] = [
    { name: 'Pokémon Atlas', href: atlasPath({ kind: 'home' }, language) },
    { name: text.catalog, href: atlasPath({ kind: 'catalog' }, language) },
    ...(form
      ? [
          {
            name: input.baseName || pokemon.name,
            href: atlasPath({ kind: 'pokemon', id: pokemon.id }, language),
          },
        ]
      : []),
    { name, href: atlasPath(page, language) },
  ]
  const result = pageSeo(
    page,
    language,
    title,
    description,
    crumbs,
    input.ogImage || input.image || `/artwork/${pokemon.id}.webp`,
    input.image || `/artwork/${pokemon.id}.webp`,
  )
  const graph = result.jsonLd['@graph'] as Record<string, unknown>[]
  graph[0].about = { '@type': 'Thing', name, identifier: form ? form.id : String(pokemon.id) }
  const reference = !!form && !(input.image || '').includes('/previews/forms/')
  result.imageAlt = reference ? `${input.baseName || pokemon.name} · ${text.standard}` : name
  if (graph[0].primaryImageOfPage)
    (graph[0].primaryImageOfPage as Record<string, unknown>).caption = result.imageAlt
  return result
}

export function buildIndexSeo(
  page: Exclude<AtlasPage, { kind: 'pokemon' }>,
  locale: string,
  options: { label?: string; count?: number; description?: string } = {},
): PageSeo {
  const language =
    (page.kind === 'help' || page.kind === 'about') && locale !== 'ja' ? 'en' : seoLocale(locale)
  const text = seoWords(language)
  const label =
    options.label ||
    (page.kind === 'home'
      ? text.home
      : page.kind === 'catalog'
        ? `${text.catalog}${page.page && page.page > 1 ? ` · ${text.page} ${page.page}` : ''}`
        : page.kind === 'type'
          ? `${page.type} · ${text.types}`
          : page.kind === 'generation'
            ? `${text.generation} ${page.generation}`
            : page.kind === 'forms'
              ? page.formKind === 'mega'
                ? text.mega
                : page.formKind === 'regional'
                  ? text.regional
                  : text.forms
              : page.kind === 'help'
                ? text.help
                : text.about)
  const crumbs = [{ name: 'Pokémon Atlas', href: atlasPath({ kind: 'home' }, language) }]
  if (page.kind !== 'home') crumbs.push({ name: label, href: atlasPath(page, language) })
  return pageSeo(
    page,
    language,
    `${label} | Pokémon Atlas`,
    options.description ||
      (page.kind === 'home'
        ? text.open
        : `${label}${options.count === undefined ? '' : ` · ${options.count}`}. ${text.index}`),
    crumbs,
  )
}
