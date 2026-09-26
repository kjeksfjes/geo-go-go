import { createApp } from 'vue'
import 'flag-icons/css/flag-icons.min.css'
import '@zanmato/vue3-treeselect/dist/vue3-treeselect.min.css'
import './styles.css'
import App from './App.vue'
import { applyDocumentLocale } from './i18n'
import { mapPalette } from './data/mapPalette'

// Read-only TreeSelect inputs can match :focus-visible after a mouse click.
// Track the active input mode so focus styling is reserved for keyboard use.
const root = document.documentElement
root.style.setProperty('--map-ocean', mapPalette.ocean)
applyDocumentLocale()
document.addEventListener('keydown', (event) => {
  if (!event.altKey && !event.ctrlKey && !event.metaKey) {
    root.dataset.inputModality = 'keyboard'
  }
}, true)
document.addEventListener('pointerdown', () => {
  root.dataset.inputModality = 'pointer'
}, true)
document.addEventListener('wheel', () => {
  root.dataset.inputModality = 'pointer'
}, { capture: true, passive: true })

createApp(App).mount('#app')
