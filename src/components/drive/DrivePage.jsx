import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudUpload, Download, File, HardDrive, RefreshCw, Trash2 } from 'lucide-react'
import { apiClient } from '../../services/apiClient'
import { formatStorageBytes as bytes } from '../../utils/storage'

export function DrivePage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [notice, setNotice] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)
  const uploadLock = useRef(false)
  const input = useRef(null)
  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await apiClient.get('/api/drive')); setError('') }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  async function upload(files) {
    if (uploadLock.current || busy) { setError('An operation is already in progress. Please wait before adding more files.'); return }
    if (!files.length) { setError('No files were received. Drop files from your computer or use Upload files. Folders are not supported.'); return }
    uploadLock.current = true
    setBusy(true); setError(''); setNotice('Checking storage…')
    try {
      const { storage: currentStorage } = await apiClient.get('/api/drive/storage')
      if (!currentStorage) throw new Error('Your storage quota is unavailable. Please refresh and try again. No files were uploaded.')
      setData((current) => current ? { ...current, storage: currentStorage } : current)
      if (currentStorage.used >= currentStorage.limit) throw new Error('Your shared mail and Drive storage is full. Delete files or emails to free up space.')
      for (const file of files) {
        if (file.size > (data?.maxFileBytes ?? 20 * 1024 * 1024)) throw new Error(`${file.name}: files must be 20 MB or smaller.`)
        const contentBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('File could not be read.'))
          reader.readAsDataURL(file)
        })
        setNotice(`Uploading ${file.name}…`)
        await apiClient.post('/api/drive', { name: file.name, contentBase64 })
      }
      setNotice('Upload complete.')
    } catch (err) { setError(err.message); setNotice('') }
    finally { await loadAfterMutation(); uploadLock.current = false; setBusy(false); if (input.current) input.current.value = '' }
  }
  function dropFiles(event) {
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setDragActive(false)
    const items = Array.from(event.dataTransfer.items ?? [])
    if (items.some((item) => item.webkitGetAsEntry?.()?.isDirectory)) {
      setError('Folders are not supported. Open the folder and drop its files instead.')
      return
    }
    const files = Array.from(event.dataTransfer.files ?? [])
    upload(files.length ? files : items.filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter(Boolean))
  }
  async function loadAfterMutation() {
    try { setData(await apiClient.get('/api/drive')); window.dispatchEvent(new Event('olivia:storage-changed')) } catch (err) { setError(err.message) }
  }
  async function download(file) {
    setBusy(true); setError('')
    try { await apiClient.download(`/api/drive/${file.id}`, file.name) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  async function remove(file) {
    setBusy(true); setError('')
    try { await apiClient.delete(`/api/drive/${file.id}`); setPendingDelete(null); setNotice('File deleted.'); await loadAfterMutation() }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  const storage = data?.storage
  const percent = storage ? Math.min(100, 100 * storage.used / storage.limit) : 0
  const files = data?.files.filter((file) => file.name.toLowerCase().includes(query.toLowerCase())) ?? []
  return (
    <section className="featurePage card drivePage">
      <div className="driveHeader"><div className="featureHero"><span className="featureIcon"><HardDrive size={24} /></span><small>Your workspace</small><h1>Drive</h1><p>Your files, together with your mail.</p></div><button type="button" className="driveButton" disabled={busy || loading} onClick={load}><RefreshCw size={15} />Refresh</button></div>
      <div className="driveQuota"><b>Shared mail & Drive storage</b><span>{storage ? `${bytes(storage.used)} of ${bytes(storage.limit)} used` : 'Storage quota unavailable'}</span><progress aria-label="Shared storage used" value={percent} max="100" />{storage ? <b>{bytes(Math.max(0, storage.limit - storage.used))} available</b> : null}<small>Your emails and files use the same plan allowance. File storage includes encoding overhead.</small></div>
      <div className={`driveDropzone ${dragActive ? 'isDragging' : ''}`} role="region" aria-label="File upload" aria-busy={busy}
        onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setDragActive(true) }}
        onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragActive(false) }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={dropFiles}>
        <CloudUpload size={30} /><b>{dragActive ? 'Release to upload your files' : 'Drop files here'}</b><span>Up to 20 MB per file</span><button className="driveButton" type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Working…' : 'Upload files'}</button><input ref={input} type="file" multiple aria-label="Choose files" hidden onChange={(event) => upload(Array.from(event.target.files))} />
      </div>
      {error ? <div className="driveError" role="alert">{error}</div> : null}
      <p role="status" className="driveStatus">{loading ? 'Loading your Drive…' : notice}</p>
      <div className="driveListHeader"><h2>My files</h2><input aria-label="Search files" placeholder="Search files…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      {!loading && data && !files.length ? <div className="tasksEmpty"><File size={24} /><b>{query ? 'No matching files' : 'Your Drive is ready'}</b><small>{query ? 'Try another filename.' : 'Upload your first file to keep it here.'}</small></div> : null}
      <div className="driveFiles">{files.map((file) => <article className="driveFile" key={file.id}><File size={20} /><div><b>{file.name}</b><small>{bytes(file.size)} stored · {new Date(file.createdAt).toLocaleDateString()}</small></div><button className="driveButton" type="button" disabled={busy} aria-label={`Download ${file.name}`} onClick={() => download(file)}><Download size={16} /></button><button className="driveButton" type="button" disabled={busy} aria-label={`Delete ${file.name}`} onClick={() => setPendingDelete(file)}><Trash2 size={16} /></button></article>)}</div>
      {pendingDelete ? <div className="driveConfirm" role="alertdialog" aria-label="Delete file" aria-describedby="driveDeleteDescription"><p id="driveDeleteDescription">Permanently delete <b>{pendingDelete.name}</b>? This frees shared storage.</p><button className="driveButton" type="button" disabled={busy} onClick={() => setPendingDelete(null)}>Cancel</button><button className="driveButton" type="button" disabled={busy} onClick={() => remove(pendingDelete)}>Delete permanently</button></div> : null}
    </section>
  )
}
