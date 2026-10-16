import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em chunks próprios: mudam pouco e ficam em cache entre deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          icones: ['lucide-react'],
        },
      },
    },
  },
})
