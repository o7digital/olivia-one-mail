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
  const response = await fetch(buildUrl(path, options.params), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-olivia-csrf': csrfToken } : {}),
      ...options.headers,
    },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
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
  delete: (path) => request(path, { method: 'DELETE' }),
  async ensureSession() {
    const me = await request('/api/me')
    if (me.authenticated) {
      csrfToken = csrfToken || getCookieValue('olivia_csrf')
      if (csrfToken) return me
    }

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'info@o7digitalgroup.com',
        password: 'phase-two-demo',
      },
    })
    csrfToken = login.csrfToken
    return request('/api/me')
  },
}
