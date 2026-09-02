import s from './ScriptIllustration.module.css'

// 文档堆叠插画（v2.5 §4.1）：空态与三段整页动效共用同一张图。
// active=false 是静态的（空态：还没有剧本，图不该假装在干活）；
// active=true 加三样动效——扫描光带在最前面那张卡上自上而下往复扫、
// 卡片里的横线依次被点亮、光环缓慢呼吸。
const LINES = ['100%', '80%', '92%', '54%', '70%']

export function ScriptIllustration({ active = false }: { active?: boolean }) {
  return (
    <div className={[s.doc, active ? s.on : ''].join(' ')} aria-hidden>
      <span className={s.ring1} />
      <span className={s.ring2} />
      <div className={[s.card, s.card1].join(' ')} />
      <div className={[s.card, s.card2].join(' ')} />
      <div className={[s.card, s.cardFront].join(' ')}>
        <span className={s.lineAcc} />
        {LINES.map((w, i) => (
          <span
            key={i}
            className={s.line}
            style={{ width: w, animationDelay: `${i * 120}ms` }}
          />
        ))}
        {active && <span className={s.scan} />}
      </div>
      <span className={s.spark1} />
      <span className={s.spark2} />
    </div>
  )
}
