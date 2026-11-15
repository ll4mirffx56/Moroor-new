export function createId(prefix = ''): string {
  let random: string
  try {
    random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  } catch {
    random = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
  return prefix ? `${prefix}-${random}` : random
}

/** Stable short hash for deterministic import identifiers. */
export function stableHash(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0
  }
  return (hash >>> 0).toString(36)
}

export function deviceId(): string {
  const key = 'moroor-device-id-v1'
  try {
    const stored = localStorage.getItem(key)
    if (stored) return stored
    const created = createId('device')
    localStorage.setItem(key, created)
    return created
  } catch {
    return 'device-unknown'
  }
}
