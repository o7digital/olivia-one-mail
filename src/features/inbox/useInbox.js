import { useCallback, useEffect, useMemo, useState } from 'react'
import { mailService } from '../../services/mailService'

export const DEFAULT_LABELS = ['Clients', 'Partnerships', 'Projects', 'Personal']

export function useMailFolders(enabled = true) {
  const [folders, setFolders] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let active = true

    async function load() {
      if (!enabled) {
        if (active) setStatus('idle')
        return
      }
      await mailService.ensureSession()
      const nextFolders = await mailService.listFolders()
      if (!active) return
      setFolders(nextFolders)
      setStatus('ready')
    }

    load()
    return () => {
      active = false
    }
  }, [enabled])

  return { folders, status }
}

export function useInbox(folder, query, enabled = true) {
  const [messages, setMessages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [knownLabels, setKnownLabels] = useState(DEFAULT_LABELS)
  const [labelFilter, setLabelFilter] = useState(null)
  const [category, setCategory] = useState('focused')
  const [sortBy, setSortBy] = useState('date-desc')

  const loadLabels = useCallback(async () => {
    if (!enabled) {
      setKnownLabels(DEFAULT_LABELS)
      return
    }
    try {
      const { labels: nextLabels } = await mailService.listLabels(folder)
      setKnownLabels(Array.from(new Set([...DEFAULT_LABELS, ...nextLabels])))
    } catch {
      setKnownLabels(DEFAULT_LABELS)
    }
  }, [enabled, folder])

  const load = useCallback(async () => {
    if (!enabled) {
      setMessages([])
      setSelectedId(null)
      setStatus('idle')
      setError(null)
      return
    }
    setStatus('loading')
    setError(null)
    try {
      await mailService.ensureSession()
      const nextMessages = await mailService.listMessages(folder)
      setMessages(nextMessages)
      setSelectedId((current) => nextMessages.some(({ id }) => id === current) ? current : nextMessages[0]?.id ?? null)
      setStatus('ready')
    } catch (loadError) {
      setError(loadError)
      setStatus('error')
    }
  }, [enabled, folder])

  useEffect(() => {
    load()
    setLabelFilter(null)
  }, [load])

  useEffect(() => {
    loadLabels()
  }, [loadLabels])

  const filteredMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    let next = normalizedQuery
      ? messages.filter((message) => (
        `${message.sender} ${message.email} ${message.company} ${message.subject} ${message.preview}`
          .toLowerCase()
          .includes(normalizedQuery)
      ))
      : messages

    if (labelFilter) {
      next = next.filter((message) => (message.labels ?? []).includes(labelFilter))
    }

    // Providers that do not classify mail yet keep their messages in Focused.
    // Unlike read/unread, this value is stable when a message is opened.
    if (folder === 'Inbox') {
      next = next.filter((message) => (message.category ?? 'focused') === category)
    }

    if (sortBy === 'date-asc') {
      next = [...next].sort((a, b) => new Date(a.receivedAt ?? 0) - new Date(b.receivedAt ?? 0))
    } else if (sortBy === 'date-desc') {
      next = [...next].sort((a, b) => new Date(b.receivedAt ?? 0) - new Date(a.receivedAt ?? 0))
    } else if (sortBy === 'label') {
      next = [...next].sort((a, b) => {
        const labelA = (a.labels ?? [])[0] ?? ''
        const labelB = (b.labels ?? [])[0] ?? ''
        if (labelA === labelB) return new Date(b.receivedAt ?? 0) - new Date(a.receivedAt ?? 0)
        if (!labelA) return 1
        if (!labelB) return -1
        return labelA.localeCompare(labelB)
      })
    }

    return next
  }, [category, folder, labelFilter, messages, query, sortBy])

  useEffect(() => {
    if (!filteredMessages.length) return
    if (!filteredMessages.some(({ id }) => id === selectedId)) {
      setSelectedId(filteredMessages[0].id)
    }
  }, [filteredMessages, selectedId])

  const selectMessage = useCallback((id) => {
    setSelectedId(id)
    setMessages((current) => current.map((message) => (
      message.id === id ? { ...message, unread: false } : message
    )))
    mailService.markRead(id)
  }, [])

  const archiveMessage = useCallback(async (id) => {
    await mailService.moveMessage(id, 'Archive')
    await load()
  }, [load])

  const deleteMessage = useCallback(async (id) => {
    await mailService.deleteMessage(id)
    await load()
  }, [load])

  const updateMessageLabels = useCallback(async (id, labels) => {
    const result = await mailService.setMessageLabels(id, labels)
    setMessages((current) => current.map((message) => (
      message.id === id ? { ...message, labels: result.labels } : message
    )))
    await loadLabels()
    return result.labels
  }, [loadLabels])

  return {
    archiveMessage,
    category,
    deleteMessage,
    error,
    filteredMessages,
    knownLabels,
    labelFilter,
    messages,
    reload: load,
    selected: messages.find(({ id }) => id === selectedId) ?? null,
    selectedId,
    selectMessage,
    setCategory,
    setLabelFilter,
    setSortBy,
    sortBy,
    status,
    updateMessageLabels,
  }
}
