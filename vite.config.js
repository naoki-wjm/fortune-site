import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    exclude: ['sweph-wasm']
  },
  assetsInclude: ['**/*.wasm'],
})
