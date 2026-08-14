import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import s from './Toast.module.css'

export function Toast() {
  const toast = useStore((st) => st.toast)
  const dismiss = useStore((st) => st.dismissToast)

  useEffect(() => {
    if (!toast) return
    // 带撤销的 toast 多留一会儿，给用户点「撤销」的时间。
    const id = window.setTimeout(dismiss, toast.action ? 5200 : 3200)
    return () => window.clearTimeout(id)
  }, [toast, dismiss])

  if (!toast) return null
  return (
    <div className={s.toast} key={toast.id}>
      <span className={s.dot} />
      <span>{toast.text}</span>
      {toast.action && (
        <button
          className={s.action}
          onClick={() => {
            toast.action!.run()
            dismiss()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
