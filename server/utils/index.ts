import type { H3Event, EventHandlerRequest } from 'h3'

export const setEventStreamResponse = (event: H3Event<EventHandlerRequest>) => {
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
}

export async function FetchWithAuth(this: { username: string | null, password: string | null }, input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)

  const username = this?.username ?? ''
  const password = this?.password ?? ''

  // Only set Authorization when username or password is provided
  if (username !== '' || password !== '') {
    const authorization = btoa(`${username}:${password}`)
    console.log(`Authorization: ${authorization}`)
    headers.set('Authorization', `Basic ${authorization}`)
  }

  return fetch(input, { ...init, headers })
}
