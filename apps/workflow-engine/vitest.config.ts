import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@synchive/shared-types': resolve(__dirname, '../../packages/shared-types/src'),
      '@synchive/logger': resolve(__dirname, '../../packages/logger/src'),
    },
  },
})
