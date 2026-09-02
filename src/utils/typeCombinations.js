import types from '../assets/json/types.json' with { type: 'json' }

const typeNamesByNormalizedName = new Map(types.map((type) => [type.name.toLowerCase(), type.name]))

function normalizeTypeName(typeName) {
  if (typeof typeName !== 'string') return null

  return typeNamesByNormalizedName.get(typeName.trim().toLowerCase()) ?? null
}

/** 返回规范化的 1～2 个属性组合；双属性的顺序不影响结果。 */
export function normalizeTypeCombination(typeNames) {
  const names = Array.isArray(typeNames) ? typeNames : [typeNames]
  if (names.length === 0 || names.length > 2) return null

  const normalizedNames = names.map(normalizeTypeName)
  if (!normalizedNames.every(Boolean) || new Set(normalizedNames).size !== normalizedNames.length) {
    return null
  }

  return normalizedNames.sort((first, second) => first.localeCompare(second))
}

const combinations = []
const keys = new Set()

types.forEach((firstType, firstIndex) => {
  const singleType = [firstType.name]
  const singleTypeKey = singleType.join('|')
  keys.add(singleTypeKey)
  combinations.push(singleType)

  types.slice(firstIndex + 1).forEach((secondType) => {
    const dualTypes = normalizeTypeCombination([firstType.name, secondType.name])
    const dualTypeKey = dualTypes.join('|')
    keys.add(dualTypeKey)
    combinations.push(dualTypes)
  })
})

export const typeCombinationKeys = keys
export const typeCombinationList = Object.freeze(combinations.map((types) => Object.freeze(types)))

export function getTypeCombinationKey(typeNames) {
  const combination = normalizeTypeCombination(typeNames)
  return combination?.join('|') ?? null
}

export function areTypeCombinationsEqual(firstTypes, secondTypes) {
  const firstKey = getTypeCombinationKey(firstTypes)
  const secondKey = getTypeCombinationKey(secondTypes)

  return Boolean(firstKey && secondKey && firstKey === secondKey)
}

export function getRandomTypeCombination() {
  const index = Math.floor(Math.random() * typeCombinationList.length)
  return [...typeCombinationList[index]]
}
