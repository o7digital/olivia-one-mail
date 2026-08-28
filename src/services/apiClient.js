const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

let csrfToken = ''

function getCookieValue(name) {
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') ?? ''
}

function buildUrl(path, params) {
  const url = new URL(`${apiBaseUrl}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

async function request(path, options = {}) {
  const hasBody = options.body !== undefined
  const response = await fetch(buildUrl(path, options.params), {
    method: options.method ?? 'GET',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'x-olivia-csrf': csrfToken } : {}),
      ...options.headers,
    },
    credentials: 'include',
    body: hasBody ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message ?? 'Request failed')
  }

  return response.json()
}

export const apiClient = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  async getCurrentUser() {
    const response = await fetch(buildUrl('/api/me'), {
      credentials: 'include',
      headers: csrfToken ? { 'x-olivia-csrf': csrfToken } : undefined,
    })

    if (response.status === 401) return null
    if (!response.ok) throw new Error('Unable to restore session')

    const payload = await response.json()
    csrfToken = csrfToken || getCookieValue('olivia_csrf')
    return payload
  },
  async login(credentials) {
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: credentials,
    })
    csrfToken = login.csrfToken
    return login
  },
  async logout() {
    await request('/api/auth/logout', { method: 'POST', body: {} })
    csrfToken = ''
  },
  async ensureSession() {
    const me = await apiClient.getCurrentUser()
    if (!me?.authenticated) {
      throw new Error('Authentication required')
    }
    return me
  },
}
