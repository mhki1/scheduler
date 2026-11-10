import { formatTime, normalizeInteger, normalizeTime, parseTime } from './time'

export const blankItem = () => ({
  id: crypto.randomUUID(),
  start: '',
  end: '',
  duration: '',
  name: '',
  drive: '',
  backup: false,
  warnings: {},
})

export function isBlankItem(item) {
  return !item.start && !item.end && !item.duration && !item.name && !item.drive && !item.backup
}

export function ensureTrailingBlank(items) {
  const copy = [...items]
  while (copy.length && isBlankItem(copy[copy.length - 1]) && copy.length > 1 && isBlankItem(copy[copy.length - 2])) {
    copy.pop()
  }
  if (!copy.length || !isBlankItem(copy[copy.length - 1])) copy.push(blankItem())
  return copy
}

function minutesOrNull(value) {
  return value === '' ? null : parseTime(value)
}

function integerOrNull(value) {
  if (value === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

function setWarning(items, index, field, message = true) {
  if (!items[index]) return
  items[index] = {
    ...items[index],
    warnings: { ...(items[index].warnings || {}), [field]: message },
  }
}

function clearWarning(items, index, field) {
  if (!items[index]) return
  const warnings = { ...(items[index].warnings || {}) }
  delete warnings[field]
  items[index] = { ...items[index], warnings }
}

export function normalizeItem(item, clearWarnings = true) {
  return {
    ...item,
    start: normalizeTime(item.start),
    end: normalizeTime(item.end),
    duration: normalizeInteger(item.duration),
    drive: normalizeInteger(item.drive),
    warnings: clearWarnings ? {} : (item.warnings || {}),
  }
}

/**
 * Run the field-specific blur calculation. The edited field is normalized first.
 * Warnings are stored per field so red text remains until that field is edited or recalculated.
 */
export function calculateField(source, index, field) {
  const items = source.map(x => ({ ...x, warnings: { ...(x.warnings || {}) } }))
  if (!items[index]) return items
  items[index] = normalizeItem(items[index], false)
  clearWarning(items, index, field)

  const item = items[index]
  const start = minutesOrNull(item.start)
  const end = minutesOrNull(item.end)

  if ((field === 'start' || field === 'end') && item[field] !== '' && parseTime(item[field]) == null) {
    setWarning(items, index, field)
    return items
  }
  const duration = integerOrNull(item.duration)
  const drive = integerOrNull(item.drive)
  const prev = items[index - 1]
  const next = items[index + 1]

  if (field === 'start') {
    if (start == null) return items
    if (prev && !prev.backup) {
      const prevEnd = minutesOrNull(prev.end)
      const prevDrive = integerOrNull(prev.drive) ?? 0
      if (prevEnd != null && start < prevEnd + prevDrive) {
        setWarning(items, index, 'start')
        return items
      }
    }
    else if (end == null && duration == null) return items
    else if (end != null && duration != null) {
      const calculatedEnd = start + duration
      if (end != calculatedEnd) {
        setWarning(items, index, 'duration')
        return items
      }
    }
    else if (end != null) {
      if (start <= end) items[index].duration = String(end - start)
      setWarning(items, index, 'end')
      return items
    }
    else {
      items[index].end = formatTime(start + duration)
    }
  }

  if (field === 'end') {
    if (end == null) return items
    if (start != null) {
      if (start > end) {
        setWarning(items, index, 'end')
        return items
      }
      items[index].duration = String(end - start)
    }
    else {
      if (duration == null) return items
      const calculatedStart = end - duration
      items[index].start = formatTime(calculatedStart)
      if (prev && !prev.backup) {
        const prevEnd = minutesOrNull(prev.end)
        const prevDrive = integerOrNull(prev.drive) ?? 0
        if (prevEnd != null && calculatedStart < prevEnd + prevDrive) {
          setWarning(items, index, 'start')
          return items
        }
      }
    }
  }

  if (field === 'duration') {
    if (start != null && end != null) {
      if (start > end) {
        setWarning(items, index, 'end')
        return items
      }
      if (duration == null) items[index].duration = String(end - start)
      else items[index].end = formatTime(start + duration)
    }
    else if (duration == null || (start == null && end == null)) return items
    else if (start != null) items[index].end = formatTime(start + duration)
    else {
      const calculatedStart = end - duration
      items[index].start = formatTime(calculatedStart)
      if (prev) {
        const prevEnd = minutesOrNull(prev.end)
        const prevDrive = integerOrNull(prev.drive) ?? 0
        if (prevEnd != null && calculatedStart < prevEnd + prevDrive) {
          setWarning(items, index, 'start')
          return items
        }
      }
    }
  }

  alert("item.backup = " + item.backup)  // checkbox reflex bug here
  
  if (field === 'backup' && !!item.backup) {
    if (prev && !prev.backup) {
      const prevEnd = minutesOrNull(prev.end)
      const prevDrive = integerOrNull(prev.drive) ?? 0
      if (prevEnd != null && start < prevEnd + prevDrive) {
        setWarning(items, index, 'start')
        return items
      }
    }
    if (start != null && end != null) {
      if (start > end) {
        setWarning(items, index, 'end')
        return items
      }
      if (duration != null && end - start != duration)  {
        setWarning(items, index, 'duration')
        return items
      }
    }
  }
  
  if (item.backup || !next || next.backup) return items
  const nextStart = minutesOrNull(next.start)
  if (field === 'drive') clearWarning(items, index + 1, 'start')
  if (nextStart != null && end + (drive ?? 0) > nextStart) setWarning(items, index + 1, 'start')

  return items
}

/**
 * Recalculate outward from selected index. The selected row is the anchor.
 * "Backup" rows are normalized/validated but skip the time adjustment.
 */
export function updateDirection(source, anchorIndex, direction) {
  let items = source.map(x => ({ ...x, warnings: { ...(x.warnings || {}) } }))
  const step = direction === 'up' ? -1 : 1
  let prevIndex = anchorIndex
  let currentIndex = anchorIndex + step

  const prev = normalizeItem(items[prevIndex], true)
  if (direction === 'down' || prev.start == '') {
    const check = [prev.start, prev.end, prev.duration]
    if (check.filter(v => v === '').length >= 2) return { items, stoppedAt: prevIndex, reason: 'Insufficient data.' }
    const start = minutesOrNull(prev.start)
    const end = minutesOrNull(prev.start)
    const duration = integerOrNull(prev.duration)
    if (start == null) prev.start = formatTime(end - duration)
    else if (end == null) prev.end = formatTime(start + duration)
    else prev.duration = String(end - start)
  }
  
  items[prevIndex] = prev
  /*

  while (currentIndex > 0 && currentIndex < items.length-1) {
    const current = normalizeItem(items[currentIndex], true)
    items[currentIndex] = current
    const prev = items[prevIndex]

    const values = [current.start, current.end, current.duration]
    const emptyCount = values.filter(v => v === '').length
    let start = minutesOrNull(current.start)
    let end = minutesOrNull(current.end)
    let duration = integerOrNull(current.duration)

    if (direction === 'up') {
      if (prev.start == null) {
        if (prev.end == null || prev.duration == null) return { items, stoppedAt: prevIndex, reason: 'Insufficient data.' }
        else prev.start = prev.end - prev.duration
      }
      end = minutesOrNull(prev.start - (current.drive ?? 0))
      source[currentIndex].end = formatTime(end)
      if (duration == null) return { items, stoppedAt: currentIndex, reason: 'Duration is mandatory.' }
      start = minutesOrNull(end - duration)
      source[currentIndex].start = formatTime(start)
    }
    else {
      if (prev.end == null) {
        if (prev.start == null || prev.duration == null) return { items, stoppedAt: prevIndex, reason: 'Insufficient data.' }
        else prev.end = prev.start + prev.duration
      }
      start = minutesOrNull(prev.end + (prev.drive ?? 0))
      source[currentIndex].start = formatTime(start)
      if (duration == null) return { items, stoppedAt: currentIndex, reason: 'Duration is mandatory.' }
      end = minutesOrNull(start + duration)
      source[currentIndex].end = formatTime(end)
    }
/*
    // Backup-plan rows are checked and normalized, but are not shifted.
    if (!current.backup) {
      const prev = items[prevIndex]
      if (direction === 'up') {
        const prevStart = minutesOrNull(prev.start)
        if (prevStart == null) return { items, stoppedAt: currentIndex, reason: 'Previous item start time is empty or invalid.' }
        const newEnd = prevStart - drive
        if (newEnd < 0) return { items, stoppedAt: currentIndex, reason: 'Calculated end time would be negative.' }
        current.end = formatTime(newEnd)
        const currentStart = minutesOrNull(current.start)
        if (currentStart == null || newEnd < currentStart) {
          return { items, stoppedAt: currentIndex, reason: 'Adjusted end time would be earlier than start time.' }
        }
        current.duration = String(newEnd - currentStart)
      } else {
        const prevEnd = minutesOrNull(prev.end)
        const prevDrive = integerOrNull(prev.drive)
        if (prevEnd == null || prevDrive == null) return { items, stoppedAt: currentIndex, reason: 'Previous item end time or drive time is empty or invalid.' }
        const newStart = prevEnd - prevDrive
        if (newStart < 0) return { items, stoppedAt: currentIndex, reason: 'Calculated start time would be negative.' }
        const currentEnd = minutesOrNull(current.end)
        if (currentEnd == null || currentEnd < newStart) {
          return { items, stoppedAt: currentIndex, reason: 'Adjusted start time would be later than end time.' }
        }
        current.start = formatTime(newStart)
        current.duration = String(currentEnd - newStart)
      }
    }

    items[currentIndex] = current
    prevIndex = currentIndex
    currentIndex += step
  }
*/
  return { items, stoppedAt: null, reason: null }
}

export function parseImport(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  if (!lines.length) return { error: 'There is no schedule data to import.' }
  const parsed = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Fields: start - end duration name drive backup. Name may contain spaces.
    const match = line.match(/^(\S+)\s+-\s+(\S+)\s+(\S+)\s+(.+?)\s+(\S+)\s+([01])$/)
    if (!match) return { error: `Line ${i + 1}: incorrect format.` }
    const [, rawStart, rawEnd, rawDuration, rawName, rawDrive, rawBackup] = match
    const start = rawStart === '00:00' ? '' : normalizeTime(rawStart)
    const end = rawEnd === '00:00' ? '' : normalizeTime(rawEnd)
    const duration = rawDuration === '0' ? '' : normalizeInteger(rawDuration)
    const drive = rawDrive === '0' ? '' : normalizeInteger(rawDrive)
    if ((rawStart !== '00:00' && parseTime(start) == null) ||
        (rawEnd !== '00:00' && parseTime(end) == null) ||
        rawDuration.trim() === '' || !Number.isFinite(Number(rawDuration)) ||
        rawDrive.trim() === '' || !Number.isFinite(Number(rawDrive))) {
      return { error: `Line ${i + 1}: invalid time, duration or drive time.` }
    }
    parsed.push({
      id: crypto.randomUUID(), start, end, duration, name: rawName.trim(),
      drive, backup: rawBackup === '1', warnings: {},
    })
  }
  return { items: ensureTrailingBlank(parsed) }
}

export function exportText(items) {
  return items.filter(x => !isBlankItem(x)).map(x => {
    const start = x.start || '00:00'
    const end = x.end || '00:00'
    const duration = x.duration || '0'
    const drive = x.drive || '0'
    const backup = x.backup ? '1' : '0'
    const name = (x.name || ' ').trim()
    return `${start} - ${end} ${duration} ${name || '-'} ${drive} ${backup}`
  }).join('\n')
}
