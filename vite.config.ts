import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // `npm run dev` gọi API đồng bộ của `wrangler dev` (chạy song song bằng `npm run dev:api`)
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ideos — sổ ý tưởng',
        short_name: 'Ideos',
        description: 'Ghi nhanh ý tưởng web/app/startup mọi lúc, kể cả khi offline.',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Ghi ý tưởng mới', short_name: 'Ghi mới', url: '/?new=1' },
          { name: 'Ôn lại ý tưởng', short_name: 'Ôn lại', url: '/#/review' },
        ],
        // Android: chia sẻ text/link từ app khác vào Ideos
        share_target: {
          action: '/',
          method: 'GET',
          params: { title: 'share_title', text: 'share_text', url: 'share_url' },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
