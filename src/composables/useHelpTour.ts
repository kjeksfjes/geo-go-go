import { nextTick, onBeforeUnmount, ref } from 'vue'
import type { Driver } from 'driver.js'
import { t } from '../i18n'
import { readStoredBoolean, writeStoredValue } from '../utils/storage'

const invitationKey = 'geo-go-go.help.invitation-dismissed'

export function useHelpTour() {
  const invitationVisible = ref(!readStoredBoolean(invitationKey, false))
  const active = ref(false)
  const loading = ref(false)
  const error = ref(false)
  let tour: Driver | undefined
  let disposed = false

  function dismissInvitation() {
    invitationVisible.value = false
    writeStoredValue(invitationKey, true)
  }

  // A settings reset restores the invitation, but never starts a tour.
  function resetInvitation() { invitationVisible.value = true }

  function blockMapMovement(event: Event) {
    if (event.target instanceof Element && event.target.closest('.driver-popover')) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  function blockAnswerShortcut(event: KeyboardEvent) {
    // Keep Driver's arrows, Tab and Escape available; suppress app shortcuts.
    if (event.key !== 'Enter' && event.code !== 'Space') return
    if (event.target instanceof Element && event.target.closest('.driver-popover')
      && !event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  function guardInput(enabled: boolean) {
    for (const type of ['wheel', 'touchstart', 'touchmove']) {
      if (enabled) window.addEventListener(type, blockMapMovement, { capture: true, passive: false })
      else window.removeEventListener(type, blockMapMovement, true)
    }
    if (enabled) window.addEventListener('keydown', blockAnswerShortcut, true)
    else window.removeEventListener('keydown', blockAnswerShortcut, true)
  }

  function finish() {
    if (!active.value) return
    active.value = false
    guardInput(false)
    // Driver restores its own focus after teardown; return to Help afterward.
    void nextTick(() => {
      if (!disposed) document.querySelector<HTMLButtonElement>('.help-button')?.focus({ preventScroll: true })
    })
  }

  async function start() {
    if (active.value || loading.value) return
    loading.value = true
    error.value = false
    try {
      const [{ driver }] = await Promise.all([
        import('driver.js'),
        import('../styles/help-tour.css'),
      ])
      if (disposed) return
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      dismissInvitation()
      await nextTick()
      if (disposed) return
      const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
      tour = driver({
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        duration: 500,
        allowClose: true,
        overlayClickBehavior: 'close',
        disableActiveInteraction: true,
        showProgress: true,
        progressText: t('helpProgress', { current: '{{current}}', total: '{{total}}' }),
        nextBtnText: t('helpNext'),
        prevBtnText: t('helpPrevious'),
        doneBtnText: t('helpDone'),
        closeBtnLabel: t('helpClose'),
        popoverClass: 'geo-help-tour',
        stageRadius: 12,
        overlayOpacity: 0.35,
        steps: [
          { element: '[data-help="region"]', popover: {
            title: t('helpRegionTitle'), description: t('helpRegionDescription'), side: 'bottom',
          } },
          { element: '[data-help="mode"]', popover: {
            title: t('helpModeTitle'), description: t('helpModeDescription'), side: 'bottom',
          } },
          { element: '[data-help="map"]', popover: {
            title: t('helpMapTitle'), description: t(touch ? 'helpMapTouch' : 'helpMapDesktop'), side: 'bottom', align: 'center',
          } },
          { element: '[data-help="settings"]', popover: {
            title: t('helpSettingsTitle'), description: t('helpSettingsDescription'), side: 'bottom', align: 'end',
          } },
        ],
        onDestroyStarted: (_element, _step, { driver }) => {
          driver.destroy()
          // Driver may omit onDestroyed if closed before its first transition ends.
          finish()
        },
        onDestroyed: finish,
      })
      active.value = true
      guardInput(true)
      tour.drive()
    } catch {
      tour?.destroy()
      active.value = false
      guardInput(false)
      error.value = true
    } finally {
      loading.value = false
    }
  }

  onBeforeUnmount(() => {
    disposed = true
    tour?.destroy()
    guardInput(false)
  })

  return { invitationVisible, active, loading, error, start, dismissInvitation, resetInvitation }
}
