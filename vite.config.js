import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH is set only for the GitHub Pages build (e.g. "/boostpanel/").
// Local dev + other hosts keep "/" so the preview keeps working.
const base = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) needs manualChunks as a function.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts')) return 'vendor-charts'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('@supabase')) return 'vendor-sb'
          if (id.includes('qrcode')) return 'vendor-qr'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router')) return 'vendor-react'
          return 'vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
})
