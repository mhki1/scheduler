export function parseTime(value) {
  const s = String(value ?? '').trim()
  if (!s) return null

  let hours, minutes
  if (/^\d{1,2}:\d{1,2}$/.test(s)) {
    const [h, m] = s.split(':')
    hours = Number(h)
    minutes = Number(m)
  } else if (/^\d{3,4}$/.test(s)) {
    const padded = s.padStart(4, '0')
    hours = Number(padded.slice(0, 2))
    minutes = Number(padded.slice(2))
  } else if (/^\d{1,2}$/.test(s)) {
    const padded = s.padStart(2, '0') + "00"
    hours = Number(padded.slice(0, 2))
    minutes = Number(padded.slice(2))
  } else {
    return null
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

export function formatTime(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return ''
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function normalizeTime(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  const parsed = parseTime(s)
  return parsed == null ? '' : formatTime(parsed)
}

export function normalizeInteger(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  const n = Number(s)
  if (!Number.isFinite(n) || n<0) return ''
  return String(Math.trunc(n))
}

export function timeDifference(start, end) {
  const a = parseTime(start)
  const b = parseTime(end)
  if (a == null || b == null) return null
  return b - a
}
