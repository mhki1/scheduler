import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, GripVertical, Plus, Trash2, Undo2, Eraser, X, Download, Upload, Clipboard, CalendarDays, AlertTriangle } from 'lucide-react'
import { blankItem, calculateField, ensureTrailingBlank, exportText, isBlankItem, parseImport, updateDirection } from './utils/schedule'

const STORAGE_KEY = 'schedule-planner'
const fields = ['start', 'end', 'duration', 'name', 'drive']

function loadInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length) return ensureTrailingBlank(parsed)
    }
  } catch (error) {
    console.warn('Could not load saved schedule:', error)
  }
  return [blankItem()]
}

function App() {
  const [items, setItems] = useState(loadInitial)
  const [trashMode, setTrashMode] = useState(false)
  const [ioOpen, setIoOpen] = useState(false)
  const [ioText, setIoText] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [dragIndex, setDragIndex] = useState(null)
  const inputRefs = useRef({})

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const visibleItems = items
  const populatedCount = items.filter(x => !isBlankItem(x)).length

  function updateItems(next) {
    setItems(ensureTrailingBlank(next))
  }

  function editField(index, field, value) {
    const next = items.map((item, i) => i === index
      ? { ...item, [field]: value, warnings: { ...(item.warnings || {}), [field]: false } }
      : item)
    updateItems(next)
  }

  function blurField(index, field) {
    updateItems(calculateField(items, index, field))
  }

  function onBackupChange(index, checked) {
    const next = items.map((item, i) => i === index
      ? { ...item, backup: checked, warnings: { ...(item.warnings || {}), backup: false } }
      : item)
    updateItems(calculateField(next, index, 'backup'))
  }

  function focusNext(index, field) {
    const nextIndex = index + 1
    if (nextIndex < items.length) inputRefs.current[`${nextIndex}-${field}`]?.focus()
	else inputRefs.current[`${index}-${field}`]?.focus()
  }

  function handleKeyDown(event, index, field) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
      focusNext(index, field)
    }
  }

  function addAt(index) {
    const next = [...items]
    next.splice(index, 0, blankItem())
    updateItems(next)
  }

  function toggleTrash() {
    setTrashMode(v => !v)
  }

  function deleteAll() {
    if (!window.confirm("Are you sure you want to delete all records?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setItems([blankItem()]);
    setTrashMode(false)
  }

  function handleRowClick(index) {
    if (!trashMode) return
    updateItems(items.filter((_, i) => i !== index))
  }

  function moveItem(from, to) {
    if (from == null || to == null || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const normalized = next.map((item, i) => i === to
      ? { ...item, start: normalizeTimeSafe(item.start), end: normalizeTimeSafe(item.end), duration: normalizeIntegerSafe(item.duration), drive: normalizeIntegerSafe(item.drive), warnings: {} }
      : item)
    updateItems(normalized)
    setDragIndex(null)
  }

  function normalizeTimeSafe(value) {
    if (!value) return ''
    const s = String(value).trim()
    let h, m
    if (/^\d{1,2}:\d{1,2}$/.test(s)) [h, m] = s.split(':').map(Number)
    else if (/^\d{1,4}$/.test(s)) {
      const p = s.padStart(4, '0')
      h = Number(p.slice(0, 2)); m = Number(p.slice(2))
    } else return s
    return m <= 59 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` : s
  }
  
  function normalizeIntegerSafe(value) {
    if (value === '') return ''
    const n = Number(value)
    return Number.isFinite(n) ? String(Math.trunc(n)) : ''
  }

  function runUpdate(index, direction) {
    const result = updateDirection(items, index, direction)
    updateItems(result.items)
    if (result.stoppedAt != null) {
      setMessage(`Update stopped at item #${result.stoppedAt + 1} (${items[result.stoppedAt].name}) : ${result.reason}`)
      setMessageType('warning')
    } else {
      setMessage(`Update ${direction === 'up' ? '↑' : '↓'} completed.`)
      setMessageType('success')
    }
  }

  function openImportExport() {
    setIoText(exportText(items))
    setIoOpen(v => !v)
  }

  function importSchedule() {
    const result = parseImport(ioText)
    if (result.error) {
      setMessage(result.error)
      setMessageType('warning')
      return
    }
    if (populatedCount > 0 && !window.confirm('This will replace your current schedule. Continue?')) return
    updateItems(result.items)
    setMessage('Schedule imported successfully.')
    setMessageType('success')
  }

  async function copyExport() {
    const text = exportText(items)
    try {
      await navigator.clipboard.writeText(text)
      setMessage('Schedule text copied to clipboard.')
      setMessageType('success')
    } catch {
      setIoText(text)
      setMessage('Clipboard access is unavailable. Select and copy the text manually.')
      setMessageType('info')
    }
  }

  function handleDrop(targetIndex) {
    if (dragIndex == null) return
    moveItem(dragIndex, targetIndex)
  }

  const hasWarnings = items.some(item => Object.values(item.warnings || {}).some(Boolean))

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><CalendarDays size={21}/></div>
          <div>
            <h1>Schedule Planner</h1>
          </div>
        </div>
        <div className="header-status"><span className="save-dot"/> Saved locally</div>
      </header>

      <section className="toolbar">
        <div className="toolbar-left">
          <button className={`btn ${ioOpen ? 'btn-info' : 'btn-secondary'}`} onClick={openImportExport}>
            <Clipboard size={16}/>{ioOpen ? 'Close Import / Export' : 'Import / Export'}
            {ioOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
          <button className={`btn ${trashMode ? 'btn-info' : 'btn-secondary'}`} onClick={toggleTrash}>
            {trashMode ? <Undo2 size={16}/> : <Trash2 size={16}/>}
            {trashMode ? 'Stop Delete Mode' : 'Delete Items'}
          </button>
          {trashMode &&
            <button className="btn btn-danger" onClick={deleteAll}>
              <Eraser size={16}/>Delete All
            </button>
          }
        </div>
        <div className="toolbar-right">
          <span className="item-count">{populatedCount} {populatedCount === 1 ? 'item' : 'items'}</span>
          <button className="btn btn-primary" onClick={() => inputRefs.current[`${items.length - 1}-start`]?.focus()}>
            <Plus size={17}/> Add Item
          </button>
        </div>
      </section>

      {ioOpen && (
        <section className="io-panel">
          <div className="io-heading">
            <div><h2>Import / Export</h2><p>One schedule item per line. The same text area is used for both actions.</p></div>
          </div>
          <textarea className="io-textarea" value={ioText} onChange={e => setIoText(e.target.value)} placeholder={'12:00 - 13:00 60 Lunch hour 30 0'} rows={6}/>
          <div className="io-actions">
            <button className="btn btn-secondary" onClick={copyExport}><Download size={15}/> Copy Current Schedule</button>
            <button className="btn btn-primary" onClick={importSchedule}><Upload size={15}/> Import Text</button>
          </div>
          <p className="format-hint">Format: Start - End Duration Item_Description Drive_Time Backup (1 or 0). Empty times export as 00:00; empty minute values export as 0.</p>
        </section>
      )}

      {message && (
        <div className={`message message-${messageType}`} role="status">
          {messageType === 'warning' ? <AlertTriangle size={17}/> : <Check size={17}/>}
          <span>{message}</span>
          <button className="message-close" onClick={() => setMessage('')} aria-label="Dismiss message"><X size={15}/></button>
        </div>
      )}

      {trashMode && <div className="trash-notice"><AlertTriangle size={16}/> Delete mode is active. Click a red X beside an item to remove it. Click "Stop Delete Mode” when finished.</div>}

      <section className="schedule-card">
        <div className="table-scroll">
          <div className="schedule-header schedule-grid">
            <div className="col-move">Order</div>
            <div>Start Time</div>
            <div>End Time</div>
            <div>Duration <small>min.</small></div>
            <div className="col-name">Item Description</div>
            <div>Drive Time <small>min.</small></div>
            <div className="col-backup">Backup</div>
            <div className="col-update">Update</div>
          </div>

          {visibleItems.map((item, index) => {
            const blank = isBlankItem(item)
            const isLastBlank = blank && index === visibleItems.length - 1
            return (
              <div key={item.id}>
                {!isLastBlank && !trashMode && (
                  <div className="insert-row">
                    <button className="insert-button" onClick={() => addAt(index)}><Plus size={13}/> Insert item here</button>
                  </div>
                )}
                <div
                  className={`schedule-row schedule-grid ${blank ? 'blank-row' : ''} ${item.backup ? 'backup-row' : ''} ${dragIndex === index ? 'dragging' : ''} ${trashMode && !isLastBlank ? 'delete-target' : ''}`}
                  onDragOver={e => { if (dragIndex != null) e.preventDefault() }}
                  onDrop={e => { e.preventDefault(); handleDrop(index) }}
                >
                  <div className="insert-hover-area"></div>
                  <div className="move-cell">
                    {trashMode && !isLastBlank
                      ? <button className="delete-x" onClick={() => handleRowClick(index)} aria-label={`Delete item ${index + 1}`}><X size={19}/></button>
                      : <span
                          className={`grip ${trashMode ? 'grip-muted' : ''}`}
                          title={blank ? 'New item row' : 'Drag to reorder'}
                          draggable={!trashMode}
                          onDragStart={e => {
                            e.stopPropagation()
                            setDragIndex(index)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => setDragIndex(null)}
                        ><GripVertical size={19}/></span>}
                  </div>
                  <Field item={item} index={index} field="start" label="Start time" refs={inputRefs} editField={editField} blurField={blurField} handleKeyDown={handleKeyDown}/>
                  <Field item={item} index={index} field="end" label="End time" refs={inputRefs} editField={editField} blurField={blurField} handleKeyDown={handleKeyDown}/>
                  <Field item={item} index={index} field="duration" label="Duration (min)" refs={inputRefs} editField={editField} blurField={blurField} handleKeyDown={handleKeyDown}/>
                  <Field item={item} index={index} field="name" label="Item name" refs={inputRefs} editField={editField} blurField={blurField} handleKeyDown={handleKeyDown}/>
                  <Field item={item} index={index} field="drive" label="Drive time (min)" refs={inputRefs} editField={editField} blurField={blurField} handleKeyDown={handleKeyDown}/>
                  <div className="backup-cell">
                    <label className="checkbox-wrap" title="Backup plan">
                      <input
                        ref={el => { inputRefs.current[`${index}-backup`] = el }}
                        type="checkbox"
                        checked={!!item.backup}
                        onChange={e => onBackupChange(index, e.target.checked)}
                        onKeyDown={e => handleKeyDown(e, index, 'backup')}
                      />
                      <span className="checkbox-custom"/>
                    </label>
                  </div>
                  <div className="update-cell">
                    {!blank && <>
                      <button className="icon-button" title="Update upwards" disabled={!!item.backup} onClick={() => runUpdate(index, 'up')}><ArrowUp size={17}/></button>
                      <button className="icon-button" title="Update downwards" disabled={!!item.backup} onClick={() => runUpdate(index, 'down')}><ArrowDown size={17}/></button>
                    </>}
                  </div>
                </div>
                {isLastBlank && <div className="bottom-hint">Start typing here to add a new item to the schedule.</div>}
              </div>
            )
          })}
        </div>
      </section>

      <footer className="footer-note">
        <span><span className="legend-red"/> Red text indicates a timing conflict or invalid time.</span>
        <span>Changes are stored in this browser only.</span>
      </footer>
    </main>
  )
}

function Field({ item, index, field, label, refs, editField, blurField, handleKeyDown }) {
  const isTime = field === 'start' || field === 'end'
  const isNumber = field === 'duration' || field === 'drive'
  const warning = !!item.warnings?.[field]
  return (
    <div className={`field-cell field-${field}`}>
      <label className="mobile-label">{label}</label>
      <input
        ref={el => { refs.current[`${index}-${field}`] = el }}
        className={`field-input ${warning ? 'input-warning' : ''} ${isTime ? 'time-input' : ''}`}
        type="text"
        inputMode={isNumber || isTime ? 'numeric' : 'text'}
        value={item[field] ?? ''}
        placeholder={field === 'name' ? 'Add activity...' : ''}
        aria-label={label}
        onChange={e => editField(index, field, e.target.value)}
        onBlur={() => blurField(index, field)}
        onKeyDown={e => handleKeyDown(e, index, field)}
      />
    </div>
  )
}

export default App
