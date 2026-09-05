import { createRoot } from 'react-dom/client'
import App from './App'
import { dictionaries } from './dictionaries'
import { initialLocale, LocaleProvider, prepareLocale } from './i18n'
import { translator } from './locales'
import { initializeSavedAnalytics } from './Privacy'
import './style.css'

// Retire the obsolete broad registration without touching saved scenes or caches.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations
          .filter((registration) => registration.scope === `${location.origin}/`)
          .map((registration) => registration.unregister()),
      ),
    )
    .catch(() => {})
}

const root = document.getElementById('root')
if (root) {
  const language = initialLocale()
  const host = root
  let retry: HTMLElement | undefined
  async function start() {
    try {
      await prepareLocale(language)
      retry?.remove()
      initializeSavedAnalytics()
      createRoot(host).render(
        <LocaleProvider initialLanguage={language}>
          <App />
        </LocaleProvider>,
      )
    } catch {
      // A failed language request must not replace a readable static page with a blank app.
      if (!retry) {
        const t = translator(dictionaries.get(language) || dictionaries.get('en') || {})
        retry = document.createElement('aside')
        retry.className = 'seo-static'
        retry.setAttribute('role', 'status')
        retry.lang = dictionaries.get(language) ? language : 'en'
        const message = document.createElement('p')
        message.textContent = t('The language could not be loaded. Try again.')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'viewer-link'
        button.textContent = t('Retry translations')
        button.addEventListener('click', () => {
          button.disabled = true
          void start().finally(() => {
            button.disabled = false
          })
        })
        retry.append(message, button)
        host.after(retry)
      }
    }
  }
  void start()
}
