// Retire only the historical root registration. Never clear origin storage.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(
    registrations.filter(registration => registration.scope === `${location.origin}/`)
      .map(registration => registration.unregister()),
  )).catch(() => {})
}
const language = new URLSearchParams(location.search).get('lang')
if (language) {
  const link = Array.from(document.querySelectorAll('a[hreflang]')).find(link => link.hreflang.toLowerCase() === language.toLowerCase())
  if (link && new URL(link.href).pathname !== location.pathname) location.replace(link.href)
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.querySelector('details')?.removeAttribute('open')
})
