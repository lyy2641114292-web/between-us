// ============================================================
// 阶段 02 初始数据（原型 6.html L2007-2043，原样迁移）
// ============================================================

export const S2_EMOTIONS = [
  { id: 'aggrieved', label: '委屈', color: '#f28c38', rgb: '242, 140, 56', selected: true },
  { id: 'ignored', label: '被忽视', color: '#5da9e9', rgb: '93, 169, 233', selected: true },
  { id: 'disappointed', label: '失望', color: '#A78BFA', rgb: '167, 139, 250', selected: false },
  { id: 'angry', label: '生气', color: '#FB7185', rgb: '251, 113, 133', selected: false },
  { id: 'fear_loss', label: '害怕失去这段关系', color: '#FBBF24', rgb: '251, 191, 36', selected: false },
]

export const S2_CORE_NEED = '我希望自己的主动与关心能被看见，而不是单方面的维系。'

export const S2_FACTS = [
  { id: 'f1', text: '上周五发出邀约消息，隔了 26 小时回复「最近有点忙，改天吧」。' },
  { id: 'f2', text: '电话中表示「觉得我最近没有认真听她说话」。' },
  { id: 'f3', text: '挂断电话后的五天里，双方都没有再主动发消息。' },
]

export const S2_INTERPRETATIONS = [
  {
    id: 'i1',
    statement: '“隔了一天才回复，说明她已经不在乎这段友情了。”',
    filterTag: '动机猜测',
    aiPrompt: '她隔了一天才回复是确认的事实，但这之间还有其他可能性吗？',
    expanded: true,
    shelved: false,
    alternatives: [],
    quickSuggestions: [
      '也许她那两天正好加班或情绪低落，没有精力社交',
      '也许她当时不知道该如何委婉拒绝而不伤害我',
    ],
  },
  {
    id: 'i2',
    statement: '“她说我没认真听她说话，是在否定我所有的付出。”',
    filterTag: '情绪放大',
    aiPrompt: '当委屈涌上来时，我们很容易把对方对「某一刻」的失落，听成对「整段关系」的否定。',
    expanded: false,
    shelved: false,
    alternatives: [],
    quickSuggestions: [
      '她可能只是针对那一通电话里的沟通状态表达感受',
      '我们双方在表达关心和倾听的方式上出现了错位',
    ],
  },
]
