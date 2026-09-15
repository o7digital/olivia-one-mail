import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Indent, Italic, Link,
  List, ListOrdered, Outdent, Quote, RemoveFormatting, Underline,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const stateCommands = {
  bold: 'bold', italic: 'italic', underline: 'underline',
  ordered: 'insertOrderedList', unordered: 'insertUnorderedList',
}

export function RichTextToolbar({ editorRef, onChange }) {
  const selectionRef = useRef(null)
  const [active, setActive] = useState({})

  const captureSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return
    selectionRef.current = selection.getRangeAt(0).cloneRange()
  }, [editorRef])

  const refreshState = useCallback(() => {
    const next = {}
    for (const [name, command] of Object.entries(stateCommands)) {
      try { next[name] = document.queryCommandState(command) } catch { next[name] = false }
    }
    setActive(next)
    captureSelection()
  }, [captureSelection])

  useEffect(() => {
    document.addEventListener('selectionchange', refreshState)
    return () => document.removeEventListener('selectionchange', refreshState)
  }, [refreshState])

  function restoreSelection() {
    const selection = window.getSelection()
    if (!selectionRef.current || !selection) return
    selection.removeAllRanges()
    selection.addRange(selectionRef.current)
  }

  function apply(command, value = null) {
    restoreSelection()
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, true)
    document.execCommand(command, false, value)
    captureSelection()
    refreshState()
    onChange()
  }

  function addLink() {
    restoreSelection()
    const entered = window.prompt('Link address')
    if (!entered) return
    const href = /^(https?:|mailto:)/i.test(entered) ? entered : `https://${entered}`
    apply('createLink', href)
  }

  function formatButton(name, label, command, icon) {
    return <button type="button" className={active[name] ? 'active' : ''} aria-label={label} aria-pressed={Boolean(active[name])} title={label} onMouseDown={(event) => event.preventDefault()} onClick={() => apply(command)}>{icon}</button>
  }

  return (
    <div className="composeFormatting" role="toolbar" aria-label="Formatting options">
      <select aria-label="Font family" defaultValue="Arial" onMouseDown={captureSelection} onChange={(event) => apply('fontName', event.target.value)}>
        <option value="Arial">Sans Serif</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Monospace</option>
      </select>
      <select className="fontSizeSelect" aria-label="Font size" defaultValue="3" onMouseDown={captureSelection} onChange={(event) => apply('fontSize', event.target.value)}>
        <option value="1">Small</option>
        <option value="3">Normal</option>
        <option value="5">Large</option>
        <option value="7">Huge</option>
      </select>
      <span className="formatDivider" />
      {formatButton('bold', 'Bold', 'bold', <Bold size={15} />)}
      {formatButton('italic', 'Italic', 'italic', <Italic size={15} />)}
      {formatButton('underline', 'Underline', 'underline', <Underline size={15} />)}
      <label className="formatColor" title="Text color"><span>A</span><input type="color" aria-label="Text color" defaultValue="#edf5ff" onMouseDown={captureSelection} onChange={(event) => apply('foreColor', event.target.value)} /></label>
      <span className="formatDivider" />
      <button type="button" aria-label="Align left" title="Align left" onMouseDown={(event) => event.preventDefault()} onClick={() => apply('justifyLeft')}><AlignLeft size={15} /></button>
      <button type="button" aria-label="Align center" title="Align center" onMouseDown={(event) => event.preventDefault()} onClick={() => apply('justifyCenter')}><AlignCenter size={15} /></button>
      <button type="button" aria-label="Align right" title="Align right" onMouseDown={(event) => event.preventDefault()} onClick={() => apply('justifyRight')}><AlignRight size={15} /></button>
      <button type="button" aria-label="Justify" title="Justify" onMouseDown={(event) => event.preventDefault()} onClick={() => apply('justifyFull')}><AlignJustify size={15} /></button>
      <span className="formatDivider" />
      {formatButton('ordered', 'Numbered list', 'insertOrderedList', <ListOrdered size={15} />)}
      {formatButton('unordered', 'Bulleted list', 'insertUnorderedList', <List size={15} />)}
      <button type="button" aria-label="Decrease indent" title="Decrease indent" onMouseDown={(event) => event.preventDefault()} onClick={() => apply('outdent')}><Outdent size={15} /></button>
      <button type="button" aria-label="Increase indent" title="Increase indent" onMouseDown={(event) => event.preventDefault()} onClick={() => apply('indent')}><Indent size={15} /></button>
      <button type="button" aria-label="Quote" title="Quote" onMouseDown={(event) => event.preventDefault()} onClick={() => apply('formatBlock', 'blockquote')}><Quote size={15} /></button>
      <button type="button" aria-label="Insert link" title="Insert link" onMouseDown={(event) => event.preventDefault()} onClick={addLink}><Link size={15} /></button>
      <button type="button" aria-label="Remove formatting" title="Remove formatting" onMouseDown={(event) => event.preventDefault()} onClick={() => apply('removeFormat')}><RemoveFormatting size={15} /></button>
    </div>
  )
}
