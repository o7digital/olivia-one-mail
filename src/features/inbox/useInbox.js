import { useCallback, useEffect, useMemo, useState } from 'react'
import { mailService } from '../../services/mailService'

export function useMailFolders() {
  const [folders, setFolders] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let active = true

    async function load() {
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
  }, [])

  return { folders, status }
}

export function useInbox(folder, query) {
  const [messages, setMessages] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
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
  }, [folder])

  useEffect(() => {
    load()
  }, [load])

  const filteredMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return messages
    return messages.filter((message) => (
      `${message.sender} ${message.email} ${message.company} ${message.subject} ${message.preview}`
        .toLowerCase()
        .includes(normalizedQuery)
    ))
  }, [messages, query])

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

  return {
    error,
    filteredMessages,
    messages,
    reload: load,
    selected: messages.find(({ id }) => id === selectedId) ?? null,
    selectedId,
    selectMessage,
    status,
  }
}
