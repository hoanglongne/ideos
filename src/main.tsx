import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Font tự host để chạy offline; cần đủ latin, latin-ext (ơ ư đ) và vietnamese (ạ ấ ự…)
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-500.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-ext-400.css'
import '@fontsource/plus-jakarta-sans/latin-ext-500.css'
import '@fontsource/plus-jakarta-sans/latin-ext-600.css'
import '@fontsource/plus-jakarta-sans/vietnamese-400.css'
import '@fontsource/plus-jakarta-sans/vietnamese-500.css'
import '@fontsource/plus-jakarta-sans/vietnamese-600.css'
import '@fontsource/newsreader/latin-400.css'
import '@fontsource/newsreader/latin-ext-400.css'
import '@fontsource/newsreader/vietnamese-400.css'
import App from './App'
import { ToastProvider } from './components/Toast'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
