import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Testes de interface simulam digitação; em máquinas lentas 5 s não bastam.
    testTimeout: 15_000,
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
