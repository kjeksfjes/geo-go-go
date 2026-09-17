import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from 'vue'

export function useElementSize(element: Ref<HTMLElement | null>) {
  const width = ref(0)
  const height = ref(0)
  let observer: ResizeObserver | undefined

  onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
      width.value = entry.contentRect.width
      height.value = entry.contentRect.height
    })

    if (element.value) {
      observer.observe(element.value)
    }
  })

  onBeforeUnmount(() => observer?.disconnect())

  return {
    width: readonly(width),
    height: readonly(height),
  }
}
