export function readStoredValue(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function readStoredBoolean(key: string, fallback: boolean): boolean {
  const value = readStoredValue(key)
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

export function writeStoredValue(key: string, value: string | boolean) {
  try { localStorage.setItem(key, String(value)) } catch { /* The setting still works for this session. */ }
}

export function clearStoredValues(prefix: string): boolean {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => key?.startsWith(prefix) === true)
    for (const key of keys) localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
