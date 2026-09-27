import { onMounted, ref, type ComponentPublicInstance } from 'vue'
import { useMapSelectMenuAnchor } from './useMapSelectMenuAnchor'

type TreeSelectInstance = ComponentPublicInstance & {
  focusInput: () => void
  toggleMenu: () => void
  closeMenu: () => void
}

// Shared interaction around the third-party control. The individual fields
// still own their option data and selection behavior.
export function useMapTreeSelectControl(
  instanceId: string,
  fieldSelector: string,
  labelId: string,
  openDirection: 'top' | 'bottom' = 'top',
) {
  const treeSelect = ref<ComponentPublicInstance | null>(null)
  const { startAligning, stopAligning } = useMapSelectMenuAnchor(
    instanceId,
    fieldSelector,
    openDirection,
  )

  function toggleFromControl(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const instance = treeSelect.value as TreeSelectInstance
    instance.focusInput()
    instance.toggleMenu()
  }

  function closeMenu() {
    (treeSelect.value as TreeSelectInstance).closeMenu()
  }

  onMounted(() => {
    // This release needs a read-only input to retain keyboard navigation
    // without exposing the search feature.
    const input = (treeSelect.value?.$el as HTMLElement | undefined)
      ?.querySelector<HTMLInputElement>('.vue3-treeselect__input')
    if (input) {
      input.readOnly = true
      input.setAttribute('aria-labelledby', labelId)
    }
  })

  return { treeSelect, toggleFromControl, closeMenu, startAligning, stopAligning }
}
