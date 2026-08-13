import { useStore } from '../store/useStore'

// 阶段③ 占位页。
export function Studio() {
  const setStage = useStore((st) => st.setStage)
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--bg1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        color: 'var(--t3)',
        textAlign: 'center',
        padding: 40,
      }}
    >
      <div style={{ fontSize: 40 }}>🎬</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>拍摄台</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.8, maxWidth: 420 }}>
        拍摄台暂未开放。这里将用于生成关键帧、视频和同期声。
      </div>
      <button
        onClick={() => setStage('visual')}
        style={{
          border: '1px solid var(--line)',
          color: 'var(--t2)',
          padding: '6px 14px',
          borderRadius: 'var(--rsm)',
          fontSize: 12,
        }}
      >
        ← 返回项目资产库
      </button>
    </div>
  )
}
