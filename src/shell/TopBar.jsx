// ============================================================
// 全站统一顶部品牌栏（原型 6.html L679-692）
// 左上「Between Us」返回首页；右上阶段徽章进入 01~05 后显现
// ============================================================
export default function TopBar({ isHome, stageMeta, onHome }) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 px-7 sm:px-12 py-6 sm:py-8 flex items-center justify-between pointer-events-none">
      <button
        type="button"
        onClick={onHome}
        className="pointer-events-auto flex items-center gap-3 group cursor-pointer focus:outline-none reveal-layer-2"
        title="返回首页视界"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#f28c38] shadow-[0_0_10px_#f28c38] group-hover:scale-125 transition-transform" />
        <span className="font-serif text-lg sm:text-xl tracking-[0.2em] text-mistwhite/95 font-normal">
          Between Us
        </span>
      </button>

      <div
        className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-deepsea/75 border border-slatefrost/15 backdrop-blur-md transition-opacity duration-500 ${
          isHome ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
        }`}
      >
        <span className="text-[11px] font-mono tracking-[0.2em] text-[#f28c38]">
          {stageMeta ? stageMeta.num : '01'}
        </span>
        <span className="w-[1px] h-3 bg-slatefrost/20" />
        <span className="text-[11px] sm:text-xs tracking-[0.2em] text-mistwhite/90">
          {stageMeta ? stageMeta.title : '记录冲突 · CAPTURE'}
        </span>
      </div>
    </header>
  )
}
