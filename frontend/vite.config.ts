import { rmSync } from 'node:fs'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const excludeRemoteOnlyVideoCopies: Plugin = {
  name: 'exclude-remote-only-video-copies',
  apply: 'build',
  closeBundle() {
    rmSync(path.resolve(__dirname, 'dist', 'video'), { recursive: true, force: true })
  },
}

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: 'src/routes',
      autoCodeSplitting: false,
    }),
    tailwindcss(),
    react(),
    excludeRemoteOnlyVideoCopies,
  ],
  resolve: {
    alias: {
      '@bindings': path.resolve(__dirname, 'bindings'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
