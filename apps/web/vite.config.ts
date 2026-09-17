import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API sets no CORS headers (apps/api/src/main.ts). Proxying /requests
// through the dev server keeps every call same-origin instead of adding
// app.enableCors() to a backend this task doesn't touch.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/requests': 'http://localhost:3000',
    },
  },
})
