// ============================================================
// 阶段 05 决定下一步数据（原型 6.html L1496-1668 + L2772-2850，原样迁移）
// ============================================================

export const S5_INTENTS = [
  { id: 'express', label: '表达感受并了解对方' },
  { id: 'explain', label: '解释自己的想法' },
  { id: 'distance', label: '暂时保持距离' },
  { id: 'undecided', label: '暂时不想做决定' },
]

// 三种语气（2026-11-16：兜底文案按意愿分成两套）
// 语气只负责长度与施压程度，不改变草的侧重
export const S5_TONE_LABELS = {
  gentle: '坦诚且温和',
  brief: '更轻盈简短',
  nopressure: '不给对方压力',
}

// 兜底草稿：AI 不可用时显示（用户已授权改写原型文案，见 docs/复刻差异清单.md 3.8）
//   express = 以「我的感受」为主体，末尾有一处了解朋友
//   explain = 以「我当时的想法」为主体，末尾不施压、不追问
export const S5_TONES_BY_INTENT = {
  express: {
    gentle: {
      text: '那天电话里我说得有点急，其实心里是有点失落的，不是想怪你。只是那几天一直等不到你回，我有点慌，怕我们就这样慢慢远了。你当时听我那样说，是什么感觉？',
    },
    brief: {
      text: '前几天电话里我有点急，其实是有点失落，也挺想你的。你当时是什么感觉？',
    },
    nopressure: {
      text: '那天我语气重了点，是那阵子心里有点空。你不用急着回，我等你方便的时候。',
    },
  },
  explain: {
    gentle: {
      text: '那天电话里我语气急了些，是那几天一直憋着想问你、又不知道怎么开口，就先急着把话说出来了。我原本是想把最近的感受讲给你听，没想到听起来像是在质问你。等你方便的时候我再慢慢说。',
    },
    brief: {
      text: '那天我急着想把话说开，语气就重了。我本来是想把最近的感受讲给你听，不是要质问你。',
    },
    nopressure: {
      text: '那天我语气急了，是因为一直不知道怎么开口。我本意是想把话讲清楚，不是要你解释什么。你不用有压力。',
    },
  },
}

// 取兜底草稿：非沟通型意愿（distance / undecided）不会显示草稿面板，
// 这里统一回落到 express，避免取值时报错
export function s5TemplateDraft(intent, tone) {
  const group = S5_TONES_BY_INTENT[intent] || S5_TONES_BY_INTENT.express
  return group[tone]?.text || group.gentle.text
}

// 第 5 条反思文案随意愿变化（原型 selectS5Intent）
// 2026-11-16 用户授权改写：每条 ≤30 字（见 docs/复刻差异清单.md 3.8）
export const S5_STEP5_BY_INTENT = {
  express: '等双方平稳，坦诚说出失落，也听听她的近况。',
  explain: '找个轻松的时机，说说当时的想法和最近的压力。',
  distance: '暂时保持距离，先照顾自己的情绪，不急着沟通。',
  undecided: '暂不做决定，让关系随时间自然沉淀。',
}

// 非沟通型意愿的面板文案（原型 selectS5Intent 的 else 分支）
export const S5_NONCOMM = {
  distance: {
    title: '允许关系暂时停留在安静的轨道上',
    desc: '完成一次反思，不意味着必须立刻修复一段友情。你不需要强迫自己现在就发出消息，先照顾好自己的能量。',
  },
  undecided: {
    title: '把决定权交还给时间，允许暂不做决定',
    desc: '此刻感到迷茫是完全正常的。你已经梳理清了事实与情绪，接下来的节奏由你自己掌握。',
  },
}

// 反思星笺五条（第 1 条会被阶段 02 的真实需求同步覆盖）
// 2026-11-16 用户授权改写：每条 ≤30 字
export const S5_REFLECTIONS_INIT = {
  care: '希望主动与关心被看见，而不是单方面维系',
  past: '因回慢又变淡，以为她不在乎这段关系',
  newPossibility: '她可能只是精力透支，我的急被听成指责',
  uncertain: '她说的「没被认真听」具体指什么',
  step5: S5_STEP5_BY_INTENT.express,
}

// 导出 txt 时的标题顺序（原型 exportS5Reflection）
export const S5_REFLECTION_KEYS = ['care', 'past', 'newPossibility', 'uncertain', 'step5']
export const S5_REFLECTION_LABELS = [
  '1. 最在意的事情',
  '2. 之前的理解',
  '3. 看见的新可能',
  '4. 尚不确定的问题',
  '5. 我决定采取的下一步行动',
]
