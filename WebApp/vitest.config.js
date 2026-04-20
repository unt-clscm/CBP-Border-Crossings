import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
})
