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
        关键帧生成、视频生成、同期声合成在这里进行。本 demo 只演示到剧本分析与视觉筹备，拍摄台留作占位。
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
        ← 返回视觉筹备
      </button>
    </div>
  )
}
