import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mailService } from '../../services/mailService'

export const DEFAULT_LABELS = ['Clients', 'Partnerships', 'Projects', 'Personal']

function inboxCacheKey(mailboxEmail, folder, page, starredOnly = false) {
  const mailbox = String(mailboxEmail || '').trim().toLowerCase()
  return mailbox ? `olivia-one:inbox-cache:v1:${encodeURIComponent(mailbox)}:${encodeURIComponent(folder)}:${page}:${starredOnly ? 'starred' : 'all'}` : ''
}

function readInboxCache(mailboxEmail, folder, page, starredOnly) {
  const key = inboxCacheKey(mailboxEmail, folder, page, starredOnly)
  if (!key) return null
  try {
    const cached = JSON.parse(window.localStorage.getItem(key) || 'null')
    if (!Array.isArray(cached?.messages) || !cached.pagination) return null
    return cached
  } catch {
    return null
  }
}

function writeInboxCache(mailboxEmail, folder, page, messages, pagination, starredOnly) {
  const key = inboxCacheKey(mailboxEmail, folder, page, starredOnly)
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
  const [revision, setRevision] = useState(0)
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
    const reload = () => setRevision((value) => value + 1)
    if (enabled) window.addEventListener('olivia:mail-sent', reload)
    const timer = enabled ? window.setInterval(() => {
      if (document.visibilityState === 'visible') setRevision((value) => value + 1)
    }, 15000) : null
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('olivia:mail-sent', reload)
    }
  }, [enabled, revision])

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
  const [starredOnly, setStarredOnly] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(null)
  const requestGeneration = useRef(0)
  const busy = useRef(false)
  const loadedPages = useRef(1)
  const hasLoaded = useRef(false)
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

  const load = useCallback(async (silent = false, background = false) => {
    if (background && busy.current) return
    if (!enabled) {
      setMessages([])
      setSelectedId(null)
      setStatus('idle')
      setError(null)
      return
    }
    const generation = ++requestGeneration.current
    busy.current = true
    setLoadingMore(false)
    setLoadMoreError(null)
    const cached = readInboxCache(mailboxEmail, folder, 1, starredOnly)
    if (!background && cached) {
      setMessages(cached.messages)
      setPagination(cached.pagination)
      setSelectedId((current) => cached.messages.some(({ id }) => id === current) ? current : cached.messages[0]?.id ?? null)
      setStatus('ready')
    } else if (!background) {
      setMessages([])
      setSelectedId(null)
      setStatus('loading')
    }
    if (!silent) setRefreshing(true)
    setError(null)
    try {
      const pageCount = background ? loadedPages.current : 1
      const responses = await Promise.all(Array.from({ length: pageCount }, (_, index) => mailService.listMessages(folder, index + 1, 25, starredOnly)))
      const response = responses[0]
      if (generation !== requestGeneration.current) return
      const nextMessages = responses.flatMap((page) => Array.isArray(page) ? page : page.messages)
      const nextPagination = Array.isArray(response)
        ? { page: 1, pageSize: nextMessages.length || 25, total: nextMessages.length, totalPages: nextMessages.length ? 1 : 0 }
        : { ...response.pagination, page: Math.min(pageCount, response.pagination.totalPages || 1) }
      loadedPages.current = nextPagination.page
      hasLoaded.current = true
      setMessages(nextMessages)
      setPagination(nextPagination)
      writeInboxCache(mailboxEmail, folder, 1, Array.isArray(response) ? response : response.messages, Array.isArray(response) ? nextPagination : response.pagination, starredOnly)
      setSelectedId((current) => nextMessages.some(({ id }) => id === current) ? current : nextMessages[0]?.id ?? null)
      setStatus('ready')
    } catch (loadError) {
      if (generation !== requestGeneration.current) return
      setError(loadError)
      if (!background || (!cached && !hasLoaded.current)) setStatus('error')
    } finally {
      if (generation === requestGeneration.current) {
        busy.current = false
        setRefreshing(false)
      }
    }
  }, [enabled, folder, mailboxEmail, starredOnly])

  const loadMore = useCallback(async () => {
    if (!enabled || busy.current || status !== 'ready' || pagination.page >= pagination.totalPages) return
    const generation = requestGeneration.current
    busy.current = true
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const response = await mailService.listMessages(folder, pagination.page + 1, 25, starredOnly)
      if (generation !== requestGeneration.current) return
      setMessages((current) => {
        const ids = new Set(current.map(({ id }) => id))
        return [...current, ...response.messages.filter(({ id }) => !ids.has(id))]
      })
      loadedPages.current = response.pagination.page
      setPagination(response.pagination)
    } catch (nextError) {
      if (generation === requestGeneration.current) setLoadMoreError(nextError)
    } finally {
      if (generation === requestGeneration.current) {
        busy.current = false
        setLoadingMore(false)
      }
    }
  }, [enabled, folder, pagination, starredOnly, status])

  useEffect(() => {
    loadedPages.current = 1
    hasLoaded.current = false
    load(true)
    return () => {
      requestGeneration.current += 1
      busy.current = false
    }
  }, [load])

  useEffect(() => {
    if (!enabled) return
    const synchronize = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) load(true, true)
    }
    const timer = window.setInterval(synchronize, folder === 'Sent' ? 3000 : 15000)
    window.addEventListener('olivia:mail-sent', synchronize)
    window.addEventListener('focus', synchronize)
    window.addEventListener('online', synchronize)
    document.addEventListener('visibilitychange', synchronize)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('olivia:mail-sent', synchronize)
      window.removeEventListener('focus', synchronize)
      window.removeEventListener('online', synchronize)
      document.removeEventListener('visibilitychange', synchronize)
    }
  }, [enabled, folder, load])

  useEffect(() => {
    setLabelFilter(null)
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
    if (starredOnly) next = next.filter((message) => message.starred)
    if (folder === 'Inbox' && !starredOnly) {
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
  }, [category, folder, labelFilter, messages, query, sortBy, starredOnly])

  useEffect(() => {
    if (!filteredMessages.length) {
      setSelectedId(null)
      return
    }
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
    if (starredOnly && !result.starred) await load(true)
    return result
  }, [load, starredOnly])

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
    checkMail: () => load(),
    deleteMessage,
    error,
    filteredMessages,
    knownLabels,
    labelFilter,
    messages,
    moveMessage,
    loadMore,
    loadingMore,
    loadMoreError,
    starredOnly,
    setStarredOnly,
    pagination,
    reload: () => load(),
    selected: messages.find(({ id }) => id === selectedId) ?? null,
    selectedId,
    selectMessage,
    setCategory,
    setLabelFilter,
    setSortBy,
    sortBy,
    status,
    refreshing,
    toggleStarMessage,
    updateMessageLabels,
  }
}
