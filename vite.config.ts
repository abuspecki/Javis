import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the build also works when loaded from a Chrome extension (chrome-extension://…/index.html)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
})
