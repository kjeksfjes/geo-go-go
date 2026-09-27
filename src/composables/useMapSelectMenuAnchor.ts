import { onBeforeUnmount } from 'vue'

const menuGap = 12
const menuMaxHeight = 320

// TreeSelect portals its menu to the body. Keep it aligned with its visible
// control and inside the viewport after the surrounding layout changes.
export function useMapSelectMenuAnchor(
  instanceId: string,
  fieldSelector: string,
  openDirection: 'top' | 'bottom',
) {
  let frame: number | null = null

  function elements() {
    const field = document.querySelector<HTMLElement>(fieldSelector)
    const anchor = field?.querySelector<HTMLElement>('.vue3-treeselect__control')
    const menu = document.querySelector<HTMLElement>(
      `.vue3-treeselect__portal-target[data-instance-id="${instanceId}"] .vue3-treeselect__menu`,
    )
    return { anchor, menu }
  }

  function alignMenu() {
    const { anchor, menu } = elements()
    if (!anchor || !menu) return false

    const anchorBounds = anchor.getBoundingClientRect()
    const availableHeight = openDirection === 'bottom'
      ? window.innerHeight - anchorBounds.bottom - menuGap - 12
      : anchorBounds.top - menuGap - 12
    menu.style.maxHeight = `${Math.max(64, Math.min(menuMaxHeight, availableHeight))}px`
    menu.style.transform = ''
    const menuBounds = menu.getBoundingClientRect()
    const shiftY = openDirection === 'bottom'
      ? anchorBounds.bottom + menuGap - menuBounds.top
      : anchorBounds.top - menuGap - menuBounds.bottom
    const shiftX = menuBounds.right > window.innerWidth - 12
      ? window.innerWidth - 12 - menuBounds.right
      : Math.max(0, 12 - menuBounds.left)
    menu.style.transform = `translate(${Math.round(shiftX)}px, ${Math.round(shiftY)}px)`
    return true
  }

  function stopAligning() {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    window.removeEventListener('resize', alignMenu)
  }

  function startAligning() {
    stopAligning()
    function afterRender(attempt = 0) {
      frame = requestAnimationFrame(() => {
        const { anchor, menu } = elements()
        if (!anchor || !menu) {
          if (attempt < 3) afterRender(attempt + 1)
          return
        }
        alignMenu()
        window.addEventListener('resize', alignMenu)
      })
    }
    afterRender()
  }

  onBeforeUnmount(stopAligning)
  return { startAligning, stopAligning }
}
