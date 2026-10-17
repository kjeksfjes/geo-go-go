import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import localMapViewControl from './scripts/dev-map-view-control.mjs'

export default defineConfig({
  plugins: [vue(), localMapViewControl()],
})
