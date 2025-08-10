import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./tests/setup.js'],
    // Alternative to deprecated 'basic' reporter
    reporters: [['default', { summary: true }]],
    exclude: [
      '**/node_modules/**',
      '**/tests/legacy/**', // Exclude legacy tests from main test run
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/legacy/**',
        'tests/helpers/**',
        'tests/setup.js',
        'cli.js', // Entry point - tested via CLI execution
        'vitest.config.js',
        'eslint.config.js',
      ],
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
})
