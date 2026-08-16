import { useEffect, useState } from 'react'
import { aiService } from '../services/aiService'

export function useAIWorkspace(messageId) {
  const [analysis, setAnalysis] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!messageId) {
      setAnalysis(null)
      setStatus('idle')
      return
    }

    let active = true

    async function load() {
      setStatus('loading')
      setError(null)
      try {
        const nextAnalysis = await aiService.getWorkspace(messageId)
        if (!active) return
        setAnalysis(nextAnalysis)
        setStatus('ready')
      } catch (loadError) {
        if (!active) return
        setError(loadError)
        setStatus('error')
      }
    }

    load()
    return () => {
      active = false
    }
  }, [messageId])

  return { analysis, error, status }
}
