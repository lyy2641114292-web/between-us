// ============================================================
// 情绪胶囊条（原型 6.html L2097-2120）
// 选中态使用 inline style 拼出径向渐变与彩色光晕，与原型字符串一致
// ============================================================
export default function EmotionPills({ emotions, onToggle }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 px-2">
      {emotions.map((em) => {
        const activeStyle = em.selected
          ? {
              borderColor: `rgba(${em.rgb}, 0.55)`,
              background: `radial-gradient(circle at 30% 30%, rgba(${em.rgb}, 0.24), rgba(11, 18, 34, 0.55))`,
              boxShadow: `0 0 24px rgba(${em.rgb}, 0.28), inset 0 1px 0 rgba(255,255,255,0.22)`,
            }
          : undefined
        const dotStyle = em.selected
          ? { background: em.color, boxShadow: `0 0 10px ${em.color}` }
          : { background: 'rgba(148, 163, 184, 0.4)' }

        return (
          <button
            key={em.id}
            type="button"
            onClick={() => onToggle(em.id)}
            style={activeStyle}
            className={`emotion-pill ${em.selected ? 'selected' : ''} px-4 py-2 rounded-full text-xs sm:text-[13px] flex items-center gap-2`}
          >
            <span className="w-2 h-2 rounded-full transition-all duration-500" style={dotStyle} />
            <span>{em.label}</span>
          </button>
        )
      })}
    </div>
  )
}
