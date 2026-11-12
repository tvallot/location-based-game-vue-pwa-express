/** Shows a system notification when allowed. Returns false if it could not be shown. */
export async function notify(title: string, body: string): Promise<boolean> {
  if (!('Notification' in window)) return false

  let permission = Notification.permission
  if (permission === 'default') permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  new Notification(title, { body, icon: '/icons/icon-192.png' })
  return true
}

export function vibrate(pattern: number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}

/** Keeps the screen on while the map is open. The lock is released when the tab is hidden. */
export function useScreenWakeLock() {
  let sentinel: WakeLockSentinel | null = null

  async function acquire() {
    if (!('wakeLock' in navigator) || sentinel) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => (sentinel = null))
    } catch {
      // Refused (e.g. battery saver). The game still works without it.
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void acquire()
  }

  return {
    supported: 'wakeLock' in navigator,
    async start() {
      document.addEventListener('visibilitychange', onVisibilityChange)
      await acquire()
    },
    async stop() {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      await sentinel?.release()
      sentinel = null
    },
  }
}

/** Shares a text with the native share sheet, or downloads it as a file. */
export async function shareText(title: string, text: string) {
  if ('share' in navigator) {
    try {
      await navigator.share({ title, text, url: window.location.origin })
      return
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'nautilus-hunt-score.txt'
  link.click()
  URL.revokeObjectURL(url)
}
