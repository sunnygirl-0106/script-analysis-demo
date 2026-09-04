import { useStore } from '../store/useStore'
import { icLg } from '../components/icons'

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
      {/* 场记板：原来是 🎬（彩色位图，各系统字形不一），换成同一套描边 svg。 */}
      <div style={{ display: 'flex', color: 'var(--t4)' }}>{icLg.clapper}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>拍摄台</div>
      <div style={{ fontSize: 13, lineHeight: 1.8, maxWidth: 420 }}>
        拍摄台暂未开放。这里将用于生成关键帧、视频和同期声。
      </div>
      <button
        onClick={() => setStage('visual')}
        style={{
          border: '1px solid var(--line)',
          color: 'var(--t2)',
          padding: '6px 14px',
          borderRadius: 'var(--rsm)',
          fontSize: 13,
        }}
      >
        ← 返回项目资产库
      </button>
    </div>
  )
}
