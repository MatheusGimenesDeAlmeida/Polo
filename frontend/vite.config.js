import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/Polo/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['kaan.png'],
      manifest: {
        name: 'Polo — Seu Feed de Leitura',
        short_name: 'Polo',
        description: 'Agregador pessoal de RSS feeds',
        theme_color: '#4a5568',
        background_color: '#4a5568',
        display: 'standalone',
        start_url: '/Polo/',
        icons: [
          { src: 'kaan.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'kaan.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
