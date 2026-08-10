import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import s from './Toast.module.css'

export function Toast() {
  const toast = useStore((st) => st.toast)
  const dismiss = useStore((st) => st.dismissToast)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(dismiss, 3200)
    return () => window.clearTimeout(id)
  }, [toast, dismiss])

  if (!toast) return null
  return (
    <div className={s.toast} key={toast.id}>
      <span className={s.dot} />
      {toast.text}
    </div>
  )
}
