import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Set VITE_API_TARGET=http://localhost:8001 if port 8000 is used by something else
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        ws: true,   // live violation alerts use a WebSocket under /api
      }
    }
  }
})
