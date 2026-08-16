import { useEffect, useState } from 'react'
import { apiClient } from '../services/apiClient'

export function useSession() {
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState(null)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        const me = await apiClient.getCurrentUser()
        if (!active) return
        setSession(me)
      } catch (restoreError) {
        if (!active) return
        setError(restoreError.message)
      } finally {
        if (active) setReady(true)
      }
    }

    restoreSession()
    return () => {
      active = false
    }
  }, [])

  async function login(credentials) {
    setError('')
    const result = await apiClient.login(credentials)
    const me = await apiClient.getCurrentUser()
    setSession(me)
    return result
  }

  async function logout() {
    await apiClient.logout()
    setSession(null)
  }

  return {
    error,
    isAuthenticated: Boolean(session?.authenticated),
    login,
    logout,
    ready,
    session,
  }
}
