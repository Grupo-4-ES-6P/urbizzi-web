import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Mesmo caminho que o Nginx usa em produção.
        '/api': {
          target: env.API_PROXY_TARGET ?? 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (caminho) => caminho.replace(/^\/api/, ''),
        },
        '/uploads': {
          target: env.API_PROXY_TARGET ?? 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
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
  }
})
