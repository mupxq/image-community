import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }, [])

  const ToastEl = toast ? (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-bg-card border border-primary rounded-lg px-5 py-3 text-sm text-text z-50 shadow-lg">
      {toast}
    </div>
  ) : null

  return { showToast, ToastEl }
}
