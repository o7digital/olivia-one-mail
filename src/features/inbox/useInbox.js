import { useCallback, useEffect, useMemo, useState } from 'react'
import { mailService } from '../../services/mailService'

export const DEFAULT_LABELS = ['Clients', 'Partnerships', 'Projects', 'Personal']

function inboxCacheKey(mailboxEmail, folder, page) {
  const mailbox = String(mailboxEmail || '').trim().toLowerCase()
  return mailbox ? `olivia-one:inbox-cache:v1:${encodeURIComponent(mailbox)}:${encodeURIComponent(folder)}:${page}` : ''
}

function readInboxCache(mailboxEmail, folder, page) {
  const key = inboxCacheKey(mailboxEmail, folder, page)
  if (!key) return null
  try {
    const cached = JSON.parse(window.localStorage.getItem(key) || 'null')
    if (!Array.isArray(cached?.messages) || !cached.pagination) return null
    return cached
  } catch {
    return null
  }
}

function writeInboxCache(mailboxEmail, folder, page, messages, pagination) {
  const key = inboxCacheKey(mailboxEmail, folder, page)
  if (!key) return
  const cachedMessages = messages.map((message, index) => index === 0
    ? {
        ...message,
        bodyText: message.bodyText?.slice(0, 80_000),
        bodyHtml: message.bodyHtml?.slice(0, 160_000),
        body: message.body?.slice(0, 24).map((line) => line.slice(0, 2_000)),
      }
    : {
        ...message,
        bodyText: undefined,
        bodyHtml: undefined,
        body: message.preview ? [message.preview] : [],
        attachments: [],
      })
  try {
    window.localStorage.setItem(key, JSON.stringify({ messages: cachedMessages, pagination }))
  } catch {
    // Mailbox display must continue when browser storage is full or unavailable.
  }
}

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
      const nextFolders = await mailService.listFolders()
      if (!active) return
      setFolders(nextFolders)
      setStatus('ready')
    }

    load().catch(() => {
      if (active) setStatus('error')
    })
    return () => {
      active = false
    }
  }, [enabled])

  return { folders, status }
}

export function useInbox(folder, query, enabled = true, mailboxEmail = '') {
  const [messages, setMessages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [status, setStatus] = useState('loading')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [knownLabels, setKnownLabels] = useState(DEFAULT_LABELS)
  const [labelFilter, setLabelFilter] = useState(null)
  const [category, setCategory] = useState('focused')
  const [sortBy, setSortBy] = useState('date-desc')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 })

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

  const load = useCallback(async (silent = false) => {
    if (!enabled) {
      setMessages([])
      setSelectedId(null)
      setStatus('idle')
      setError(null)
      return
    }
    const cached = readInboxCache(mailboxEmail, folder, page)
    if (cached) {
      setMessages(cached.messages)
      setPagination(cached.pagination)
      setSelectedId((current) => cached.messages.some(({ id }) => id === current) ? current : cached.messages[0]?.id ?? null)
      setStatus('ready')
    } else if (!silent) {
      setStatus('loading')
    }
    if (!silent) setRefreshing(true)
    setError(null)
    try {
      const response = await mailService.listMessages(folder, page)
      const nextMessages = Array.isArray(response) ? response : response.messages
      const nextPagination = Array.isArray(response)
        ? { page: 1, pageSize: nextMessages.length || 25, total: nextMessages.length, totalPages: nextMessages.length ? 1 : 0 }
        : response.pagination
      setMessages(nextMessages)
      setPagination(nextPagination)
      writeInboxCache(mailboxEmail, folder, page, nextMessages, nextPagination)
      setSelectedId((current) => nextMessages.some(({ id }) => id === current) ? current : nextMessages[0]?.id ?? null)
      setStatus('ready')
    } catch (loadError) {
      setError(loadError)
      if (!cached) setStatus('error')
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [enabled, folder, mailboxEmail, page])

  useEffect(() => {
    load(true)
    setLabelFilter(null)
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [folder])

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
    mailService.markRead(id).catch(() => {
      // A sandbox mailbox is read-only; restore the server state on refusal.
      load(true)
    })
  }, [load])

  const runOptimisticMove = useCallback(async (id, action) => {
    let previousMessages = []
    setMessages((current) => {
      previousMessages = current
      return current.filter((message) => message.id !== id)
    })
    try {
      const result = await action()
      await load(true)
      return result
    } catch (error) {
      setMessages(previousMessages)
      setSelectedId(id)
      setStatus('ready')
      throw error
    }
  }, [load])

  const moveMessage = useCallback(async (id, targetFolder) => (
    runOptimisticMove(id, () => mailService.moveMessage(id, targetFolder))
  ), [runOptimisticMove])

  const archiveMessage = useCallback(async (id) => moveMessage(id, 'Archive'), [moveMessage])

  const deleteMessage = useCallback(async (id) => (
    runOptimisticMove(id, () => mailService.deleteMessage(id))
  ), [runOptimisticMove])

  const toggleStarMessage = useCallback(async (id) => {
    const result = await mailService.toggleStar(id)
    setMessages((current) => current.map((message) => message.id === id ? { ...message, starred: result.starred } : message))
    return result
  }, [])

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
      checkMail: () => {
        if (page !== 1) setPage(1)
        else load()
      },
    deleteMessage,
    error,
    filteredMessages,
    knownLabels,
    labelFilter,
    messages,
    moveMessage,
    page,
    pagination,
    reload: () => load(),
    selected: messages.find(({ id }) => id === selectedId) ?? null,
    selectedId,
    selectMessage,
    setCategory,
    setLabelFilter,
    setPage,
    setSortBy,
    sortBy,
    status,
    refreshing,
    toggleStarMessage,
    updateMessageLabels,
  }
}
