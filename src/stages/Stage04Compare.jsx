// ============================================================
// 阶段 04：对照视角 · COMPARE（原型 6.html L1323-1490 + L2679-2762）
//
// 与原型对应：
// - 点左右任一侧气泡 → 同步 activeContextKey 并切换中间「未知」项
// - 点中间三个「未知」胶囊 → 中间「我的理解 / 换位体感」随之切换
// - 「展开完整原话与换位记录」抽屉
// - 抽屉里「最在意的」同步阶段 02 的真实需求
// ============================================================
import { useApp } from '../state/AppProvider.jsx'
import { S4_OTHER_BUBBLES, S4_SELF_BUBBLES, S4_UNKNOWNS } from '../data/stage04.js'
import AiStatusBar from './stage02/AiStatusBar.jsx'
import { useStage04AI } from './stage04/useStage04AI.js'

export default function Stage04Compare({ onNext, onPrev, onOpenStillpoint, toast }) {
  const { state, actions } = useApp()
  const s4 = state.stage04
  const coreNeed = state.stage02.coreNeed

  // 进入本阶段时生成双视角对照
  const ai = useStage04AI(toast)

  // AI 优先，否则用模板
  const selfList = s4.selfBubbles || S4_SELF_BUBBLES
  const otherList = s4.otherBubbles || S4_OTHER_BUBBLES
  const unknownList = s4.unknowns || S4_UNKNOWNS

  const curSelf = selfList.find((b) => b.id === s4.activeSelfId) || selfList[0]
  const curOther = otherList.find((b) => b.id === s4.activeOtherId) || otherList[0]
  const curUnknown = unknownList.find((u) => u.id === s4.activeUnknownId) || unknownList[0]

  return (
    <section className="flex-col gap-6 w-full flex">
      <div className="text-center max-w-md mx-auto">
        <h1 className="font-serif-sc text-xl sm:text-[26px] font-light text-slate-100 tracking-wide">双重视角对照</h1>
      </div>

      {/* AI 生成状态 */}
      <div className="w-full max-w-3xl mx-auto">
        <AiStatusBar
          status={ai.status}
          error={ai.error}
          regenerating={ai.regenerating}
          onRegenerate={ai.regenerate}
          hasFragments={ai.hasFragments}
        />
      </div>

      {/* 双星交叠星野 */}
      <div aria-label="双星交叠星野" className="relative w-full max-w-3xl mx-auto pt-1 pb-2">
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-75" viewBox="0 0 760 150" fill="none">
          <ellipse cx="290" cy="68" rx="195" ry="54" stroke="rgba(242, 140, 56, 0.22)" strokeWidth="0.95" />
          <ellipse
            cx="470"
            cy="68"
            rx="195"
            ry="54"
            stroke="rgba(93, 169, 233, 0.22)"
            strokeWidth="0.95"
            strokeDasharray="3 5"
          />
          <circle r="2.2" fill="#fbbf24" opacity="0.85">
            <animateMotion dur="12s" repeatCount="indefinite" path="M 95 68 A 195 54 0 1 1 485 68 A 195 54 0 1 1 95 68" />
          </circle>
          <circle r="2.2" fill="#7dd3fc" opacity="0.85">
            <animateMotion dur="14s" repeatCount="indefinite" path="M 665 68 A 195 54 0 1 0 275 68 A 195 54 0 1 0 665 68" />
          </circle>
        </svg>

        <div className="relative z-10 flex items-center justify-around px-4 sm:px-14">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="relative w-24 h-24 flex items-center justify-center float-gentle">
              <div className="absolute inset-[-12px] rounded-full bg-[#f28c38]/22 blur-2xl" />
              <div className="star-track-cw absolute inset-0.5 rounded-full border border-[#f28c38]/35 border-dashed">
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-200 shadow-[0_0_8px_#f28c38]" />
              </div>
              <div className="star-track-ccw absolute inset-2.5 rounded-full border border-amber-300/20" />
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 via-[#f28c38] to-orange-950 star-amber-glow" />
            </div>
            <span className="text-xs tracking-[0.16em] text-[#f28c38]">我的视角</span>
          </div>

          <div className="hidden sm:flex flex-col items-center text-center space-y-1.5 opacity-85">
            <span className="w-2 h-2 rounded-full bg-amber-200/90 shadow-[0_0_12px_rgba(251,191,36,0.9)] coral-pulse" />
            <span className="text-[11px] tracking-[0.18em] text-slate-400">交叠地带</span>
          </div>

          <div className="flex flex-col items-center text-center space-y-2">
            <div className="relative w-24 h-24 flex items-center justify-center float-gentle" style={{ animationDelay: '-2.5s' }}>
              <div className="absolute inset-[-12px] rounded-full bg-[#5da9e9]/22 blur-2xl" />
              <div className="star-track-ccw absolute inset-0.5 rounded-full border border-[#5da9e9]/35 border-dashed">
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-sky-200 shadow-[0_0_8px_#5da9e9]" />
              </div>
              <div className="star-track-cw absolute inset-2.5 rounded-full border border-sky-300/20" />
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-white via-[#5da9e9] to-blue-950 star-blue-glow" />
            </div>
            <span className="text-xs tracking-[0.16em] text-[#5da9e9]">换位体验</span>
          </div>
        </div>
      </div>

      {/* 三栏对照 */}
      <div aria-label="双重视角与交叠核心对比" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pt-1">
        {/* 左：我的视角 */}
        <div className="lg:col-span-3 wing-card rounded-[24px] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs tracking-[0.12em] text-[#f28c38] font-medium">我的视角</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#f28c38]" />
          </div>

          <div className="flex flex-col gap-1.5">
            {selfList.map((b) => {
              const isActive = b.id === s4.activeSelfId
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => actions.s4SelectSelf(b.id)}
                  className={`bubble-pill w-full px-3 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 text-left ${
                    isActive
                      ? 'bg-[#f28c38]/22 text-amber-100 border border-[#f28c38]/50 shadow-[0_0_16px_rgba(242,140,56,0.25)]'
                      : 'bg-white/[0.03] text-slate-300/80 border border-white/[0.06] hover:border-[#f28c38]/35'
                  }`}
                >
                  <span className="truncate">{b.label}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-amber-300' : 'bg-white/15'}`} />
                </button>
              )
            })}
          </div>

          <div className="pt-3 border-t border-white/[0.06]">
            <p className="font-serif-sc text-sm text-slate-100 font-normal leading-relaxed">{curSelf.headline}</p>
          </div>
        </div>

        {/* 中：各自的理解 */}
        <div className="lg:col-span-6 hero-focal-card rounded-[26px] p-6 sm:p-7 space-y-5 relative overflow-hidden">
          <div className="absolute inset-x-12 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-200/50 to-transparent pointer-events-none" />

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
            <h2 className="font-serif-sc text-base sm:text-lg text-amber-100 font-normal tracking-wide">各自的理解</h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {unknownList.map((u) => {
              const isActive = u.id === s4.activeUnknownId
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => actions.s4SelectUnknown(u.id)}
                  className={`unknown-pill px-2.5 py-2 rounded-xl text-[11px] sm:text-xs text-center truncate ${
                    isActive
                      ? 'bg-amber-400/20 text-amber-100 border border-amber-300/45 font-medium shadow-[0_0_18px_rgba(251,191,36,0.2)]'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300/85 border border-white/[0.07]'
                  }`}
                >
                  {u.pillLabel}
                </button>
              )
            })}
          </div>

          <div className="space-y-3 transition-all duration-500">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f28c38]/[0.07] border border-[#f28c38]/20 p-3.5 space-y-1">
                <span className="text-[11px] tracking-wider text-orange-300/90">我的理解</span>
                <p className="text-xs sm:text-[13px] text-slate-100 leading-relaxed">{curUnknown.selfRead}</p>
              </div>

              <div className="rounded-2xl bg-[#5da9e9]/[0.07] border border-[#5da9e9]/20 p-3.5 space-y-1">
                <span className="text-[11px] tracking-wider text-sky-300/90">换位体感</span>
                <p className="text-xs sm:text-[13px] text-slate-100 leading-relaxed">{curUnknown.otherRead}</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.08] flex justify-end">
            <button
              type="button"
              onClick={onOpenStillpoint}
              className="px-4 py-1.5 rounded-full text-xs bg-amber-400/15 hover:bg-amber-400/25 text-amber-100 border border-amber-300/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>让静观梳理此切片</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* 右：换位体验 */}
        <div className="lg:col-span-3 wing-card rounded-[24px] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs tracking-[0.12em] text-[#5da9e9] font-medium">换位体验</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#5da9e9]" />
          </div>

          <div className="flex flex-col gap-1.5">
            {otherList.map((b) => {
              const isActive = b.id === s4.activeOtherId
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => actions.s4SelectOther(b.id)}
                  className={`bubble-pill w-full px-3 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 text-left ${
                    isActive
                      ? 'bg-[#5da9e9]/22 text-sky-100 border border-[#5da9e9]/50 shadow-[0_0_16px_rgba(93,169,233,0.25)]'
                      : 'bg-white/[0.03] text-slate-300/80 border border-white/[0.06] hover:border-[#5da9e9]/35'
                  }`}
                >
                  <span className="truncate">{b.label}</span>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-sky-200' : 'bg-white/15'}`} />
                </button>
              )
            })}
          </div>

          <div className="pt-3 border-t border-white/[0.06]">
            <p className="font-serif-sc text-sm text-slate-100 font-normal leading-relaxed">{curOther.headline}</p>
          </div>
        </div>
      </div>

      {/* 完整记录抽屉 */}
      <div className="pt-0.5">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={actions.s4ToggleDrawer}
            className="wing-card hover:bg-white/[0.05] rounded-full px-4 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <span>{s4.drawerOpen ? '收起完整原话与换位记录' : '展开完整原话与换位记录'}</span>
            <span
              className="transition-transform duration-500"
              style={{ transform: s4.drawerOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▾
            </span>
          </button>
        </div>

        <div className={`expand-drawer mt-3 ${s4.drawerOpen ? 'open' : ''}`}>
          <div className="expand-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="wing-card rounded-[20px] p-4 space-y-2.5 text-xs text-slate-300/90 leading-relaxed">
                <div className="text-[#f28c38] tracking-wider text-[11px] font-medium">我当时心里的真实想法</div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#f28c38]/15 text-orange-200 text-[11px] shrink-0">真正想说</span>
                  <p className="text-slate-200">“我很珍惜这段友情，总得不到回应让我有点失落。”</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 text-[11px] shrink-0">最在意的</span>
                  <p className="text-slate-300">{coreNeed}</p>
                </div>
              </div>
              <div className="wing-card rounded-[20px] p-4 space-y-2.5 text-xs text-slate-300/90 leading-relaxed">
                <div className="text-[#5da9e9] tracking-wider text-[11px] font-medium">换位后看到的小误会</div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#5da9e9]/15 text-sky-200 text-[11px] shrink-0">听起来像</span>
                  <p className="text-slate-200">说“一直都是我在主动”，容易让她觉得在被翻旧账、被指责。</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 text-[11px] shrink-0">她的状态</span>
                  <p className="text-slate-300">她自己也很累、想被倾听，遇到压力时下意识躲开了。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onPrev} className="text-xs text-slatefrost/75 hover:text-mistwhite cursor-pointer">
          ← 返回角色交换
        </button>
        <button
          type="button"
          onClick={onNext}
          className="cta-warm text-white text-xs sm:text-sm font-medium tracking-wider px-6 py-2.5 rounded-full flex items-center gap-2 cursor-pointer"
        >
          <span>决定下一步</span>
          <span>→</span>
        </button>
      </div>
    </section>
  )
}
