// ============================================================
// 阶段 04 对照视角数据（原型 6.html L2679-2696，原样迁移）
// ============================================================

export const S4_SELF_BUBBLES = [
  { id: 'sb1', label: '委屈 · 渴望双向回应', headline: '希望主动与关心得到双向回应，而非单方面维系。', contextKey: 'delay26' },
  { id: 'sb2', label: '被忽视 · 怕失去关系', headline: '隔 26 小时才收到回复时，泛起不被重视的失落。', contextKey: 'delay26' },
  { id: 'sb3', label: '冤枉 · 付出被否定', headline: '听到「没认真听」时，觉得过往关心被全盘抹去。', contextKey: 'listening' },
]

export const S4_OTHER_BUBBLES = [
  { id: 'ob1', label: '疲惫防卫 · 精力透支', headline: '面对指责感时，本能反应是解释压力或退回沉默。', contextKey: 'delay26' },
  { id: 'ob2', label: '委屈反击 · 未被倾听', headline: '在她的记忆里，或许也积压着几次想开口被打断的瞬间。', contextKey: 'listening' },
  { id: 'ob3', label: '害怕越说越糟 · 沉默', headline: '五天静默未必是冷漠，也可能是不知道如何安全破冰。', contextKey: 'silence5' },
]

export const S4_UNKNOWNS = [
  {
    id: 'u1',
    contextKey: 'delay26',
    pillLabel: '26h延迟回复',
    selfRead: '隔了 26 小时才回，说明她已经不在乎这段关系了。',
    otherRead: '工作疲惫到无力社交，或怕当下状态不佳敷衍了你。',
    detailDesc: '已知事实：隔 26 小时回复「最近有点累」，真实原因仍未核对。',
  },
  {
    id: 'u2',
    contextKey: 'listening',
    pillLabel: '“没认真听”时刻',
    selfRead: '她说我没认真听，是在否定我这段时间所有的付出。',
    otherRead: '她当时可能只需要情绪被接住，而不是急着听建议。',
    detailDesc: '已知事实：电话中她曾这样表达，具体所指尚待核对。',
  },
  {
    id: 'u3',
    contextKey: 'silence5',
    pillLabel: '五天静默',
    selfRead: '挂断电话后五天都没联系，这段友情可能要结束了。',
    otherRead: '怕带着情绪开口又引发争吵，暂时退回安全距离冷静。',
    detailDesc: '已知事实：挂断电话后五天双方均未主动发消息。',
  },
]
