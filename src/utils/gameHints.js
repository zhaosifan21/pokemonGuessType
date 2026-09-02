import types from '../assets/json/types.json' with { type: 'json' }
import { getAttackResultText } from './attackResultDisplay.js'
import { getTypeMultiplier } from './typeEffectiveness.js'

const allTypeNames = types.map((type) => type.name)
const typeByNormalizedName = new Map(types.map((type) => [type.name.toLowerCase(), type]))

const attackHintTemplates = [
  (typeName) => `尝试用【${typeName}】属性攻击吧。`,
  (typeName) => `用【${typeName}】属性攻击试试？`,
  (typeName) => `也许【${typeName}】属性能带来新的线索。`,
  (typeName) => `最后的攻击机会，不妨交给【${typeName}】属性。`,
]

const avoidHintTemplates = [
  (typeNames) => `先别考虑${formatTypeList(typeNames, '和')}啦。`,
  (typeNames) => `${formatTypeList(typeNames, '和')}看起来不太可能出现。`,
  (typeNames) => `可以暂时排除${formatTypeList(typeNames, '和')}。`,
  (typeNames) => `别再猜${formatTypeList(typeNames, '和')}啦。`,
]

const preferHintTemplates = [
  (typeNames) => `不妨试试包含${formatTypeList(typeNames, '或')}的组合？`,
  (typeNames) => `${formatTypeList(typeNames, '或')}值得优先考虑。`,
  (typeNames) => `下一次猜测，可以带上${formatTypeList(typeNames, '或')}。`,
  (typeNames) => `选上${formatTypeList(typeNames, '或')}试试？`,
]

function normalizeTypeName(typeName) {
  if (typeof typeName !== 'string') return null

  return typeByNormalizedName.get(typeName.trim().toLowerCase())?.name ?? null
}

function getRandomIndex(length, random) {
  if (length <= 1) return 0

  const value = Number(random())
  const normalizedValue = Number.isFinite(value)
    ? Math.min(0.9999999999999999, Math.max(0, value))
    : 0

  return Math.floor(normalizedValue * length)
}

function pickRandom(items, random) {
  if (!items.length) return null

  return items[getRandomIndex(items.length, random)]
}

function pickRandomItems(items, count, random) {
  const pool = [...items]
  const selectedItems = []

  while (pool.length && selectedItems.length < count) {
    const selectedIndex = getRandomIndex(pool.length, random)
    selectedItems.push(pool.splice(selectedIndex, 1)[0])
  }

  return selectedItems
}

function getChineseTypeName(typeName) {
  const normalizedTypeName = normalizeTypeName(typeName)
  return normalizedTypeName
    ? typeByNormalizedName.get(normalizedTypeName.toLowerCase()).nameCHS
    : typeName
}

function formatTypeList(typeNames, conjunction) {
  const labels = typeNames.map((typeName) => `【${getChineseTypeName(typeName)}】`)

  if (labels.length <= 1) return labels[0] ?? ''
  if (labels.length === 2) return labels.join(conjunction)

  return `${labels.slice(0, -1).join('、')}${conjunction}${labels.at(-1)}`
}

/** 计算一次攻击在所有当前候选答案下，平均能够排除多少个候选组合。 */
export function getExpectedAttackEliminations(attackTypeName, possibleCombinations, displayMode) {
  const normalizedAttackTypeName = normalizeTypeName(attackTypeName)
  if (!normalizedAttackTypeName || !Array.isArray(possibleCombinations)) return null
  if (possibleCombinations.length === 0) return null

  const resultBuckets = new Map()

  for (const combination of possibleCombinations) {
    const multiplier = getTypeMultiplier(normalizedAttackTypeName, combination)
    if (multiplier === null) return null

    const visibleResult = getAttackResultText(multiplier, displayMode)
    resultBuckets.set(visibleResult, (resultBuckets.get(visibleResult) ?? 0) + 1)
  }

  const totalCombinations = possibleCombinations.length
  const expectedRemainingCombinations = [...resultBuckets.values()].reduce(
    (total, bucketSize) => total + bucketSize ** 2 / totalCombinations,
    0,
  )

  return totalCombinations - expectedRemainingCombinations
}

/** 从尚可使用的攻击属性中，随机返回期望排除候选数并列最高的一种。 */
export function getRecommendedAttackType({
  possibleCombinations = [],
  availableAttackTypeNames = allTypeNames,
  displayMode,
  random = Math.random,
} = {}) {
  const normalizedAttackTypeNames = [
    ...new Set(availableAttackTypeNames.map(normalizeTypeName).filter(Boolean)),
  ]
  let highestScore = -Infinity
  let bestAttackTypeNames = []

  normalizedAttackTypeNames.forEach((typeName) => {
    const score = getExpectedAttackEliminations(typeName, possibleCombinations, displayMode)
    if (score === null) return

    if (score > highestScore + Number.EPSILON) {
      highestScore = score
      bestAttackTypeNames = [typeName]
    } else if (Math.abs(score - highestScore) <= Number.EPSILON) {
      bestAttackTypeNames.push(typeName)
    }
  })

  return pickRandom(bestAttackTypeNames, random)
}

/** 按 80% / 15% / 5% 的概率决定提示 1 / 2 / 3 个属性。 */
export function getHintTypeCount(random = Math.random) {
  const value = Number(random())

  if (!Number.isFinite(value) || value < 0.8) return 1
  if (value < 0.95) return 2
  return 3
}

/** 根据候选组合中的属性出现频率，生成“排除”或“优先考虑”的结构化建议。 */
export function getGuessTypeRecommendation({
  possibleCombinations = [],
  typeNames = allTypeNames,
  random = Math.random,
} = {}) {
  if (!Array.isArray(possibleCombinations) || possibleCombinations.length === 0) return null

  const normalizedTypeNames = [...new Set(typeNames.map(normalizeTypeName).filter(Boolean))]
  const frequencyByTypeName = new Map(normalizedTypeNames.map((typeName) => [typeName, 0]))

  possibleCombinations.forEach((combination) => {
    new Set(combination.map(normalizeTypeName).filter(Boolean)).forEach((typeName) => {
      if (frequencyByTypeName.has(typeName)) {
        frequencyByTypeName.set(typeName, frequencyByTypeName.get(typeName) + 1)
      }
    })
  })

  const highestFrequency = Math.max(...frequencyByTypeName.values())
  const impossibleTypeNames = normalizedTypeNames.filter(
    (typeName) => frequencyByTypeName.get(typeName) === 0,
  )
  const highestFrequencyTypeNames = normalizedTypeNames.filter(
    (typeName) => frequencyByTypeName.get(typeName) === highestFrequency,
  )
  const preferredTypeNames = normalizedTypeNames.filter(
    (typeName) => frequencyByTypeName.get(typeName) >= highestFrequency * 0.7,
  )

  const canAvoid = impossibleTypeNames.length > 0
  const canPrefer = highestFrequency > 0
  if (!canAvoid && !canPrefer) return null

  const kind =
    canAvoid && canPrefer ? (random() < 0.5 ? 'avoid' : 'prefer') : canAvoid ? 'avoid' : 'prefer'
  const desiredCount = getHintTypeCount(random)

  if (kind === 'avoid') {
    return {
      kind,
      typeNames: pickRandomItems(impossibleTypeNames, desiredCount, random),
    }
  }

  const primaryTypeName = pickRandom(highestFrequencyTypeNames, random)
  const additionalTypeNames = pickRandomItems(
    preferredTypeNames.filter((typeName) => typeName !== primaryTypeName),
    desiredCount - 1,
    random,
  )

  return {
    kind,
    typeNames: [primaryTypeName, ...additionalTypeNames],
  }
}

export function createAttackHintText(options = {}) {
  const random = options.random ?? Math.random
  const typeName = getRecommendedAttackType({ ...options, random })
  if (!typeName) return null

  const template = pickRandom(attackHintTemplates, random)
  return template(getChineseTypeName(typeName))
}

export function createGuessHintText(options = {}) {
  const random = options.random ?? Math.random
  const recommendation = getGuessTypeRecommendation({ ...options, random })
  if (!recommendation?.typeNames.length) return null

  const templates = recommendation.kind === 'avoid' ? avoidHintTemplates : preferHintTemplates
  const template = pickRandom(templates, random)

  return template(recommendation.typeNames)
}
