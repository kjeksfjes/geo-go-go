export function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    // A hidden tab may pause animation frames; never leave the map locked.
    const timeout = window.setTimeout(resolve, 1000)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.clearTimeout(timeout)
      resolve()
    }))
  })
}

export function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
