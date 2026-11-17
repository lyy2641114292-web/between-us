// ============================================================
// 错误边界：任一阶段组件抛错时，显示可读的错误信息而不是白屏。
// 目的：避免「点了没反应 / 页面全黑」这类无法定位的问题。
// ============================================================
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // 开发期输出详细堆栈
    console.error('[Between Us] 组件渲染失败:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="rounded-2xl border border-[#f28c38]/35 bg-[#f28c38]/[0.06] p-6 sm:p-8">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[#f28c38]" />
          <h2 className="font-serif-sc text-lg text-mistwhite">这一部分暂时无法显示</h2>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-slatefrost/75">
          页面的其他部分仍可正常使用。你可以返回上一步，或刷新重试。
        </p>
        <pre className="mb-4 max-h-40 overflow-auto rounded-xl bg-abyss/70 p-3 text-[11px] leading-relaxed text-amber-200/85">
          {String(this.state.error && this.state.error.message)}
        </pre>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-full bg-slatefrost/15 px-4 py-1.5 text-xs text-mistwhite"
          >
            重试
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-slatefrost/25 px-4 py-1.5 text-xs text-mistwhite/85"
          >
            刷新页面
          </button>
        </div>
      </div>
    )
  }
}
