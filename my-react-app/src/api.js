const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'https://booking-backend-c77p.onrender.com').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (response.status === 204) {
    if (!response.ok) throw new ApiError(`Request failed (${response.status})`, response.status)
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new ApiError(`API returned an unexpected response (${response.status})`, response.status)
  }

  const payload = await response.json()
  if (!response.ok) {
    throw new ApiError(payload.error || `Request failed (${response.status})`, response.status)
  }
  return payload
}
