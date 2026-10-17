import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://productive-inc-studio.github.io/Inc-Tracker/
export default defineConfig({
  base: '/Inc-Tracker/',
  plugins: [react()],
  server: { port: 5173 },
})
