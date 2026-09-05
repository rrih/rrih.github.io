import type { PageSeo } from './seo'

export function applyPageSeo(seo: PageSeo) {
  document.title = seo.title
  const meta = (name: string, content: string, property = false) => {
    const attribute = property ? 'property' : 'name'
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)
    if (!element) {
      element = document.createElement('meta')
      element.setAttribute(attribute, name)
      document.head.append(element)
    }
    element.content = content
  }
  meta('description', seo.description)
  meta('og:title', seo.title, true)
  meta('og:description', seo.description, true)
  meta('og:url', seo.canonical, true)
  meta('og:locale', seo.ogLocale, true)
  meta('og:image', seo.image, true)
  meta('og:image:alt', seo.imageAlt, true)
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = seo.canonical
  for (const previous of document.head.querySelectorAll('link[hreflang]')) previous.remove()
  for (const alternate of seo.alternates) {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = alternate.lang
    link.href = alternate.href
    document.head.append(link)
  }
  let structured = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]')
  if (!structured) {
    structured = document.createElement('script')
    structured.type = 'application/ld+json'
    document.head.append(structured)
  }
  structured.textContent = JSON.stringify(seo.jsonLd)
}
