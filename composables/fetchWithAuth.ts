export const fetchWithAuth: typeof fetch = (request, opts?) => {
  const { token } = useAuth()
  const headers: any = { ...opts?.headers }
  if (token.value) {
    headers.Authorization = token.value
  }
  return fetch(request, {
    ...opts,
    headers
  })
}

function _fetchWithAuth(request: any, opts?: any) {
  const { token } = useAuth()
  const headers: any = { ...opts?.headers }
  if (token.value) {
    headers.Authorization = token.value
  }
  return $fetch(request, {
    ...opts,
    headers
  })
}

_fetchWithAuth.raw = $fetch.raw
_fetchWithAuth.create = $fetch.create

export const $fetchWithAuth = _fetchWithAuth as typeof $fetch
