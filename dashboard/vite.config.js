import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: true, // Permitir cualquier host en EasyPanel
    host: true,         // Escuchar en 0.0.0.0
    port: 80
  },
  server: {
    host: true
  }
})
