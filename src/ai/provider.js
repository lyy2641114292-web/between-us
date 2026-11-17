// ============================================================
// 真实大模型接口占位（当前不接入）
//
// 决策（docs/复刻差异清单.md 3.x / docs/需求.md F13）：
//   本阶段只留接口与开关，不实现网络调用。
//
// 【未来接入时的三条硬约束】
// 1. API Key 绝不能出现在前端代码里。必须由服务端转发，
//    前端只调用自己的 /api/chat 端点（见 docs/技术方案.md 第 4 节）。
// 2. 失败时必须降级回 stillpointEngine 的剧本回复，不能白屏或空转。
// 3. 提示词必须遵守产品红线：
//    - 不生成用户没说过的话
//    - 对方视角一律使用假设措辞（也许 / 可能 / 尚待核对）
//    - 不判断冲突双方对错
//    - 不替用户决定是否修复关系
// ============================================================

// 开关：改为 true 且配置好服务端后才会走真实模型
export const USE_REAL_LLM = false

/**
 * 请求静观回复。
 * 当前实现始终返回 null，调用方据此回落到本地剧本引擎。
 *
 * @param {object} params
 * @param {string} params.stage      当前阶段标识（如 'stage04'）
 * @param {string} params.focusKey   当前观测焦点（如 'delay26'）
 * @param {Array}  params.history    对话历史 [{role:'user'|'assistant', content:string}]
 * @param {string} params.userText   本次用户输入
 * @returns {Promise<{reply: string[], questions?: string[]} | null>}
 */
export async function requestStillpointReply({ stage, focusKey, history, userText }) {
  if (!USE_REAL_LLM) return null

  // —— 未来实现示例（保持注释，避免误用）——
  // const res = await fetch('/api/stillpoint', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ stage, focusKey, history, userText }),
  // })
  // if (!res.ok) return null            // 失败即降级
  // const data = await res.json()
  // return { reply: data.reply, questions: data.questions }

  return null
}
