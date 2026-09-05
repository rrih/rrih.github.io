import { createRoot } from 'react-dom/client'
import App from './App'
import { LocaleProvider } from './i18n'
import './style.css'

const root = document.getElementById('root')
if (root)
  createRoot(root).render(
    <LocaleProvider>
      <App />
    </LocaleProvider>,
  )
