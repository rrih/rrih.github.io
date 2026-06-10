import { siteConfig } from '@/config/site'
import type { Metadata } from 'next'

export const locales = ['ja', 'en'] as const

export type Locale = (typeof locales)[number]

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

export function detectLocaleFromPathname(pathname: string | null | undefined): Locale | null {
  if (!pathname) {
    return null
  }

  const segment = pathname.split('/').filter(Boolean)[0]
  return segment && isLocale(segment) ? segment : null
}

export function stripLocalePrefix(pathname: string | null | undefined): string {
  if (!pathname) {
    return '/'
  }

  const locale = detectLocaleFromPathname(pathname)

  if (!locale) {
    return pathname || '/'
  }

  const stripped = pathname.replace(`/${locale}`, '')
  return stripped || '/'
}

export function localizePath(path: string, locale: Locale | null): string {
  if (!locale || !path.startsWith('/')) {
    return path
  }

  if (detectLocaleFromPathname(path)) {
    return path
  }

  if (path === '/') {
    return `/${locale}`
  }

  return `/${locale}${path}`
}

export function switchLocalePath(pathname: string, locale: Locale): string {
  return localizePath(stripLocalePrefix(pathname), locale)
}

export function localizeMetadata(base: Metadata, locale: Locale, path: string): Metadata {
  const localizedPath = localizePath(path, locale)
  const canonical = `${siteConfig.url}${localizedPath}`

  return {
    ...base,
    alternates: {
      ...base.alternates,
      canonical,
      languages: {
        ja: `${siteConfig.url}${localizePath(path, 'ja')}`,
        en: `${siteConfig.url}${localizePath(path, 'en')}`,
      },
    },
    openGraph: {
      ...base.openGraph,
      locale: locale === 'ja' ? 'ja_JP' : 'en_US',
      url: canonical,
    },
  }
}

export const uiCopy = {
  ja: {
    nav: {
      home: 'ホーム',
      homework: '課題管理',
      timetable: '時間割',
      articles: '記事',
    },
    footer: {
      privacy: 'プライバシーポリシー',
      terms: '利用規約',
      about: 'About',
    },
    home: {
      heroTitle: '学校で本当に使うものだけを、\n0から作り直す。',
      heroDescription:
        '学生・学校関係者が、ログインなしで使える軽量な共有ツール。保存は端末内またはURLだけで完結します。',
      openHomework: '課題管理を開く',
      openTimetable: '時間割を見る',
      available: 'いま使えるもの',
      upcoming: '次に作るもの',
      homeworkTitle: '課題・提出物トラッカー',
      homeworkDescription: '今日やることと今週の締切をまとめて管理します。',
      timetableTitle: '時間割共有',
      timetableDescription: '授業予定をURLだけで共有できる時間割です。',
      checklistTitle: '持ち物・提出物チェック',
      checklistDescription: '遠足、実験、行事の忘れ物を減らすチェックリスト。',
      itineraryTitle: '学校行事しおり',
      itineraryDescription: '修学旅行や文化祭のしおりをそのまま配れる形で作成。',
    },
    homework: {
      title: '課題・提出物トラッカー',
      description:
        '今日やるものと、今週の締切をひとつの画面で整理します。完了状態はこの端末だけに残し、一覧はURLで共有できます。',
      add: '課題を追加',
      share: '共有',
      sharedLoaded: '共有URLから読み込みました。完了状態や表示条件はこの端末にだけ保存されます。',
      search: '検索',
      filter: '絞り込み',
      reset: 'この端末の保存を消去',
      completed: '完了済み',
      completedDescription: '提出済みのものはここにまとめて残します。',
      tabs: {
        today: '今日',
        week: '7日以内',
        all: 'すべて',
      },
    },
    notFound: {
      title: 'ページが見つかりません',
      description: 'ページが存在しないか、移動した可能性があります。',
      home: 'ホームへ戻る',
      back: '前のページへ戻る',
      tools: '使えるツール',
    },
    install: {
      title: 'アプリとして追加',
      description: '起動しやすくなり、オフラインでも開けます',
      install: '追加',
      later: 'あとで',
    },
  },
  en: {
    nav: {
      home: 'Home',
      homework: 'Homework',
      timetable: 'Timetable',
      articles: 'Articles',
    },
    footer: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      about: 'About',
    },
    home: {
      heroTitle: 'Rebuilding school tools\nfrom first principles.',
      heroDescription:
        'Lightweight tools for students and schools. No login. Data stays in the browser or in the URL.',
      openHomework: 'Open Homework Tracker',
      openTimetable: 'Open Timetable',
      available: 'Available now',
      upcoming: 'Planned next',
      homeworkTitle: 'Homework Tracker',
      homeworkDescription: 'Track today’s work and upcoming deadlines in one place.',
      timetableTitle: 'Shareable Timetable',
      timetableDescription: 'A timetable you can restore and share with nothing but a URL.',
      checklistTitle: 'School Checklist',
      checklistDescription: 'A checklist for trips, labs, and school events.',
      itineraryTitle: 'School Event Guide',
      itineraryDescription: 'Create itineraries for trips, festivals, and school events.',
    },
    homework: {
      title: 'Homework Tracker',
      description:
        'Keep today’s tasks and this week’s deadlines in one view. Completion stays on this device. The board itself can be shared by URL.',
      add: 'Add Assignment',
      share: 'Share',
      sharedLoaded:
        'Loaded from a shared URL. Completion state and display filters stay on this device only.',
      search: 'Search',
      filter: 'Filter',
      reset: 'Clear saved data on this device',
      completed: 'Completed',
      completedDescription: 'Finished work stays here when you need to look back.',
      tabs: {
        today: 'Today',
        week: '7 days',
        all: 'All',
      },
    },
    notFound: {
      title: 'Page not found',
      description: "This page doesn't exist or may have moved.",
      home: 'Go Home',
      back: 'Go Back',
      tools: 'Available Tools',
    },
    install: {
      title: 'Install app',
      description: 'Open it faster and keep it available offline',
      install: 'Install',
      later: 'Later',
    },
  },
} as const
