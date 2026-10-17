// Receipts for complete drafts already incorporated into maintained map data.
// Match the entire draft, never just its IDs: later edits must stay recoverable.
const integratedFingerprints = new Set<string>([
  '3ab9e961a2910ff84d9c526ec42f9b100f7add326e0fcf2b39266609956b581f',
])

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => [key, canonical(value)]))
  return value
}

export async function isIntegratedWaterDraft(text: string): Promise<boolean> {
  if (text.length > 2_000_000) return false
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(JSON.parse(text))))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return integratedFingerprints.has(fingerprint)
}
