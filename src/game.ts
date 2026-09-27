import { createApp } from 'vue'
import 'flag-icons/css/flag-icons.min.css'
import '@zanmato/vue3-treeselect/dist/vue3-treeselect.min.css'
import './styles.css'
import App from './App.vue'
import { applyDocumentLocale } from './i18n'
import { mapPalette } from './data/mapPalette'

document.documentElement.style.setProperty('--map-ocean', mapPalette.ocean)
applyDocumentLocale()
createApp(App).mount('#app')
