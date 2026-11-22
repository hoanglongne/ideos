import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Font tự host để chạy offline (Inter có sẵn bộ ký tự tiếng Việt)
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/bricolage-grotesque/wght.css'
import App from './App'
import { ToastProvider } from './components/Toast'
import './styles.css'
import './leaf.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
