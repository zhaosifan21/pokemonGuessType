export const attackResultDisplayModes = Object.freeze({
  NORMAL: 'normal',
  CHAMPIONS: 'champions',
  MULTIPLIER: 'multiplier',
})

const validDisplayModes = new Set(Object.values(attackResultDisplayModes))

/** 将无效的显示模式回退为默认的常规模式。 */
export function normalizeAttackResultDisplayMode(mode) {
  return validDisplayModes.has(mode) ? mode : attackResultDisplayModes.NORMAL
}

/** 根据所选显示模式和伤害倍率，返回攻击记录应展示的结果文字。 */
export function getAttackResultText(multiplier, mode) {
  const displayMode = normalizeAttackResultDisplayMode(mode)

  if (displayMode === attackResultDisplayModes.MULTIPLIER) {
    return `造成${multiplier}倍伤害`
  }

  if (multiplier === 0) return '没有效果'
  if (multiplier === 0.25) {
    return displayMode === attackResultDisplayModes.CHAMPIONS ? '效果相当不好' : '效果不好'
  }
  if (multiplier === 0.5) return '效果不好'
  if (multiplier === 4) {
    return displayMode === attackResultDisplayModes.CHAMPIONS ? '效果无比绝佳' : '效果绝佳'
  }
  if (multiplier === 2) return '效果绝佳'

  return '有效果'
}
