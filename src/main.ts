// Read-only TreeSelect inputs can match :focus-visible after a mouse click.
// Track the active input mode so focus styling is reserved for keyboard use.
const root = document.documentElement
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

// Safari intentionally ignores viewport scale limits for accessibility. This
// app provides its own map pinch gesture, so cancel Safari's separate page
// gesture before it can scale and pan the complete interface.
function preventPageZoom(event: Event) {
  event.preventDefault()
}

document.addEventListener('gesturestart', preventPageZoom, { passive: false })
document.addEventListener('gesturechange', preventPageZoom, { passive: false })

function bootLocale() {
  try {
    const saved = localStorage.getItem('geo-go-go.locale')
    if (saved === 'en' || saved === 'nb') return saved
  } catch { /* Private browsing may deny storage. */ }

  const language = navigator.languages?.[0] ?? navigator.language
  return /^(nb|nn|no)(-|$)/i.test(language) ? 'nb' : 'en'
}

const initialLocale = bootLocale()
root.lang = initialLocale
const bootTitle = document.querySelector<HTMLElement>('#boot-title')
const bootStatus = document.querySelector<HTMLElement>('#boot-status')
if (initialLocale === 'nb') {
  if (bootTitle) bootTitle.textContent = 'Hvor i verden?'
  if (bootStatus) bootStatus.textContent = 'Laster kartet…'
}

async function loadGame() {
  try {
    await import('./game')
  } catch (error) {
    console.error('Could not start Geo Go Go.', error)
    if (bootStatus) {
      bootStatus.textContent = initialLocale === 'nb'
        ? 'Kartet kunne ikke lastes. Prøv å laste siden på nytt.'
        : 'The map could not load. Try refreshing the page.'
      bootStatus.classList.add('boot-status--error')
    }
  }
}

// Give the browser a guaranteed opportunity to paint the lightweight shell
// before downloading and evaluating the geography-heavy game bundle.
requestAnimationFrame(() => requestAnimationFrame(() => void loadGame()))
