let reloaded = false

export default defineNuxtPlugin(() => {
  if (process.server) return

  // Check if we just reloaded
  if (window.sessionStorage.getItem('auth-reloaded')) {
    window.sessionStorage.removeItem('auth-reloaded')
    console.log('[SessionInterceptor] Page just reloaded, will not reload again')
  }

  globalThis.$fetch = new Proxy(globalThis.$fetch, {
    apply: async (target, thisArg, args) => {
      try {
        const response = await target.apply(thisArg, args)
        return response
      } catch (error: any) {
        const data = error?.data
        if (data?.statusCode === 401 && data?.statusMessage === 'Session expired') {
          if (!reloaded && !window.sessionStorage.getItem('auth-reloaded')) {
            reloaded = true
            window.sessionStorage.setItem('auth-reloaded', '1')
            console.log('[SessionInterceptor] Session expired, reloading page...')
            window.location.reload()
          }
        }
        throw error
      }
    }
  })
})