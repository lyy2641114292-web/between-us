// ============================================================
// 应用舞台：首页视界 ⇄ 工作台（原型 6.html 导航引擎 L1850-1935 的 React 化）
//
// 与原型的行为对应关系：
// - 首页时 tidalCanvas opacity = 1，工作台时 = 0.22
// - body overflow-hidden 仅首页生效
// - 阶段切换：先淡出当前（240ms 后再移除 active），再置 active 并触发 visible
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'

import { useApp } from './state/AppProvider.jsx'

import ContourCanvas from './atmosphere/ContourCanvas.jsx'
import TidalCanvas from './atmosphere/TidalCanvas.jsx'
import Nebula from './atmosphere/Nebula.jsx'
import CursorHalo from './atmosphere/CursorHalo.jsx'
import PaperGrainDefs from './atmosphere/PaperGrainDefs.jsx'

import TopBar from './shell/TopBar.jsx'
import ScatterNav from './shell/ScatterNav.jsx'
import Toast, { useToast } from './shell/Toast.jsx'
import SaveIndicator from './shell/SaveIndicator.jsx'
import ErrorBoundary from './shell/ErrorBoundary.jsx'
import BinaryVeil, { useBinarySwap } from './shell/BinaryVeil.jsx'
import Stillpoint from './shell/Stillpoint.jsx'
import AiNotice from './shell/AiNotice.jsx'

import Home from './stages/Home.jsx'
import Stage01Capture from './stages/Stage01Capture.jsx'
import Stage02Understand from './stages/Stage02Understand.jsx'
import Stage03Explore from './stages/Stage03Explore.jsx'
import Stage04Compare from './stages/Stage04Compare.jsx'
import Stage05Decide from './stages/Stage05Decide.jsx'
import { STAGE_META } from './data/stages.js'

const STAGE_COMPONENTS = [
  Stage01Capture,
  Stage02Understand,
  Stage03Explore,
  Stage04Compare,
  Stage05Decide,
]

export default function App() {
  const { state, actions } = useApp()
  const [isHome, setIsHome] = useState(true)
  const [stageIndex, setStageIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const toast = useToast()
  const transitionTimer = useRef(null)
  const swapTargetRef = useRef(2)

  // 首页锁定页面滚动（原型 document.body.classList.add('overflow-hidden')）
  useEffect(() => {
    if (isHome) document.body.classList.add('overflow-hidden')
    else document.body.classList.remove('overflow-hidden')
    return () => document.body.classList.remove('overflow-hidden')
  }, [isHome])

  const openHome = useCallback(() => {
    clearTimeout(transitionTimer.current)
    setIsHome(true)
    setVisible(false)
  }, [])

  const goStage = useCallback(
    (idx) => {
      if (idx < 0 || idx >= STAGE_META.length) return
      clearTimeout(transitionTimer.current)
      const wasHome = isHome
      setIsHome(false)
      setStageIndex(idx)

      if (wasHome) {
        // 从首页进入：直接置 active 再触发 visible
        setVisible(false)
        requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
        if (window.scrollY > 10) window.scrollTo({ top: 0, behavior: 'auto' })
        return
      }

      // 阶段之间切换：原型先淡出 240ms，再切换并渐显
      setVisible(false)
      transitionTimer.current = setTimeout(() => {
        if (window.scrollY > 10) window.scrollTo({ top: 0, behavior: 'auto' })
        setVisible(true)
      }, 240)
    },
    [isHome],
  )

  useEffect(() => () => clearTimeout(transitionTimer.current), [])

  // 02 ⇄ 03 双星互换（原型 triggerS2ToS3Swap / triggerS3ToS2Swap）
  // 480ms 后切阶段，920ms 后遮罩淡出；快速连点由 busy 守卫忽略
  const swap = useBinarySwap({
    onSwitch: () => {
      const target = swapTargetRef.current
      if (target < 0 || target >= STAGE_META.length) return
      setStageIndex(target)
      setVisible(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      if (window.scrollY > 10) window.scrollTo({ top: 0, behavior: 'auto' })
    },
  })

  const startSwap = useCallback(
    (target, direction) => {
      swapTargetRef.current = target
      swap.start(direction)
    },
    [swap],
  )

  const StageComp = STAGE_COMPONENTS[stageIndex]

  // 打开静观抽屉（阶段 04 的「让静观梳理此切片」调用）
  const stillpointActions = {
    openWithContext: () => actions.spSetOpen(true),
    // 带一条内容打开静观（阶段 02 的「就这条问问静观」）
    openWithSeed: (seed) => actions.spOpenWithSeed(seed),
  }

  return (
    <>
      {/* 层 0：隐藏 SVG 滤镜定义 */}
      <PaperGrainDefs />

      {/* 层 1：WebGL 等高线 */}
      <ContourCanvas />

      {/* 层 2：潮汐粒子 */}
      <TidalCanvas opacity={isHome ? 1 : 0.22} />

      {/* 层 3：星云 */}
      <Nebula />

      {/* 层 4：光标光晕 */}
      <CursorHalo />

      {/* 顶栏 */}
      <TopBar isHome={isHome} stageMeta={STAGE_META[stageIndex]} onHome={openHome} />

      {/* 首页视界：常驻挂载，用 .is-hidden 切换（与原型一致，返回时不会重播入场动画） */}
      <Home onEnter={() => goStage(0)} hidden={!isHome} />

      {/* 工作台 */}
      <div
        className={`transition-opacity duration-500 ${
          isHome ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <main className="relative z-10 w-full min-h-screen pt-24 pb-36 px-4 sm:px-8 lg:px-14 flex flex-col justify-center max-w-7xl mx-auto">
          {/* 注意：不加 flex 工具类。原型 .stage-view 默认 display:none，
              .stage-view.active 才 display:flex。多写 flex 会让未激活视图可见。 */}
          <div className={`stage-view w-full ${visible ? 'active visible' : ''}`}>
            <ErrorBoundary key={stageIndex}>
              <StageComp
                index={stageIndex}
                title={STAGE_META[stageIndex].title}
                toast={toast.show}
                swapping={swap.phase === 'visible'}
                onNext={() => goStage(stageIndex + 1)}
                onPrev={() => (stageIndex === 2 ? startSwap(1, 'toSelf') : goStage(stageIndex - 1))}
                onExploreOther={() => startSwap(2, 'toOther')}
                onOpenStillpoint={() => stillpointActions.openWithContext()}
                onAskStillpoint={(seed) => stillpointActions.openWithSeed(seed)}
              />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* 底部散落导航 */}
      <ScatterNav activeIndex={isHome ? -1 : stageIndex} onSelect={goStage} />

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />

      {/* 本机存档状态 */}
      <SaveIndicator />

      {/* 02 ⇄ 03 双星互换幕布 */}
      <BinaryVeil phase={swap.phase} direction={swap.direction} />

      {/* 静观浮标 + 观察舱（全站常驻） */}
      <Stillpoint
        stageIndex={isHome ? -1 : stageIndex}
        activeContextKey={state.stage04.activeContextKey}
        toast={toast.show}
      />

      {/* 首次使用 AI 的隐私告知 */}
      <AiNotice />
    </>
  )
}
