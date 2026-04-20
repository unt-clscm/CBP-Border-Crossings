import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: process.cwd(),
  base: process.env.VITE_BASE || './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
})
