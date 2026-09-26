import { onBeforeUnmount } from 'vue'

const menuGap = 12
const menuMaxHeight = 320

// TreeSelect portals its menu to the body. Its automatic position is relative
// to the small inner field, while these fields sit inside a larger map toolbar.
// Align both menus to the same visible edge instead of adjusting them separately.
export function useMapSelectMenuAnchor(instanceId: string, fieldSelector: string) {
  let frame: number | null = null

  function elements() {
    const field = document.querySelector<HTMLElement>(fieldSelector)
    const anchor = window.matchMedia('(max-width: 850px)').matches
      ? field?.querySelector<HTMLElement>('.vue3-treeselect__control')
      : field?.closest<HTMLElement>('.map-controls')
    const menu = document.querySelector<HTMLElement>(
      `.vue3-treeselect__portal-target[data-instance-id="${instanceId}"] .vue3-treeselect__menu`,
    )
    return { anchor, menu }
  }

  function alignMenu() {
    const { anchor, menu } = elements()
    if (!anchor || !menu) return false

    const anchorTop = anchor.getBoundingClientRect().top
    menu.style.maxHeight = `${Math.max(64, Math.min(menuMaxHeight, anchorTop - menuGap - 12))}px`
    menu.style.transform = ''
    const shift = anchorTop - menuGap - menu.getBoundingClientRect().bottom
    menu.style.transform = `translateY(${Math.round(shift)}px)`
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
