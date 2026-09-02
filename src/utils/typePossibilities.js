import { getTypeCombinationKey, typeCombinationList } from './typeCombinations.js'
import { getAttackResultText } from './attackResultDisplay.js'
import { getTypeMultiplier } from './typeEffectiveness.js'

function isMatchingAttackRecord(combination, record) {
  if (!record || !Number.isFinite(record.multiplier)) return true

  const attackerTypes = record.typeNames ?? record.typeName
  const actualMultiplier = getTypeMultiplier(attackerTypes, combination)

  if (actualMultiplier === null) return false

  const displayedResult = getAttackResultText(record.multiplier, record.displayMode)
  const candidateResult = getAttackResultText(actualMultiplier, record.displayMode)

  return candidateResult === displayedResult
}

function getIncorrectGuessKeys(guessHistory) {
  return new Set(
    guessHistory
      .filter((guess) => guess && guess.isCorrect === false)
      .map((guess) => getTypeCombinationKey(guess.types ?? guess.typeNames))
      .filter(Boolean),
  )
}

/**
 * 找出所有与当前游戏记录中“玩家可见结果”相符的单属性或双属性防御组合。
 * 常规模式会合并 2×/4× 与 0.5×/0.25× 的结果；宝冠军模式和直接显示倍率
 * 则可保留完整倍率信息。
 * 无效或尚未填写完整的记录会被忽略，因此可以在 UI 组装回合数据时安全调用。
 */
export function getPossibleTypeCombinations(attackHistory = [], guessHistory = []) {
  const attacks = Array.isArray(attackHistory) ? attackHistory : []
  const incorrectGuessKeys = getIncorrectGuessKeys(Array.isArray(guessHistory) ? guessHistory : [])

  return typeCombinationList
    .filter((combination) => {
      const combinationKey = getTypeCombinationKey(combination)

      return (
        !incorrectGuessKeys.has(combinationKey) &&
        attacks.every((record) => isMatchingAttackRecord(combination, record))
      )
    })
    .sort(
      (firstCombination, secondCombination) => firstCombination.length - secondCombination.length,
    )
    .map((combination) => [...combination])
}
