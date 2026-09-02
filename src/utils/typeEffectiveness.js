import typeEffectiveness from '../assets/json/type-effectiveness.json' with { type: 'json' }
import types from '../assets/json/types.json' with { type: 'json' }

const typesByName = new Map(types.map((type) => [type.name.toLowerCase(), type]))
const typeNames = [...typesByName.keys()]
const effectivenessByAttacker = new Map(
  Object.entries(typeEffectiveness).map(([attackerName, matchups]) => [
    attackerName.toLowerCase(),
    new Map(
      Object.entries(matchups).map(([defenderName, multiplier]) => [
        defenderName.toLowerCase(),
        multiplier,
      ]),
    ),
  ]),
)

function normalizeTypeName(typeName) {
  if (typeof typeName !== 'string') return null

  const normalizedName = typeName.trim().toLowerCase()
  return typesByName.has(normalizedName) ? normalizedName : null
}

function normalizeTypeNames(typeNames) {
  const names = Array.isArray(typeNames) ? typeNames : [typeNames]
  if (names.length === 0) return null

  const normalizedNames = names.map(normalizeTypeName)
  return normalizedNames.every(Boolean) ? normalizedNames : null
}

function getMultiplierByNormalizedNames(attackerName, defenderName) {
  return effectivenessByAttacker.get(attackerName)?.get(defenderName) ?? 1
}

function createAttackMatchups() {
  return {
    superEffective: [],
    resisted: [],
    immune: [],
    neutral: [],
  }
}

function createDefenseMatchups() {
  return {
    weakTo: [],
    resists: [],
    immuneTo: [],
    neutralTo: [],
  }
}

/**
 * 返回一个或多个攻击属性与防御属性之间的伤害倍率。
 * 支持传入字符串或数组。每一组攻防属性的倍率都会相乘，因此双属性防御方和
 * 未来可能出现的双属性攻击方都无需额外处理。无效或空输入会返回 null。
 */
export function getTypeMultiplier(attackerNames, defenderNames) {
  const attackers = normalizeTypeNames(attackerNames)
  const defenders = normalizeTypeNames(defenderNames)

  if (!attackers || !defenders) return null

  return attackers.reduce(
    (totalMultiplier, attacker) =>
      defenders.reduce(
        (attackerMultiplier, defender) =>
          attackerMultiplier * getMultiplierByNormalizedNames(attacker, defender),
        totalMultiplier,
      ),
    1,
  )
}

/** 返回单个攻击属性对应的防御属性对象，并按伤害倍率分组。 */
export function getAttackMatchups(attackerName) {
  const attacker = normalizeTypeName(attackerName)
  if (!attacker) return null

  const matchups = createAttackMatchups()

  typeNames.forEach((defender) => {
    const multiplier = getMultiplierByNormalizedNames(attacker, defender)
    const type = typesByName.get(defender)

    if (multiplier === 2) matchups.superEffective.push(type)
    else if (multiplier === 0.5) matchups.resisted.push(type)
    else if (multiplier === 0) matchups.immune.push(type)
    else matchups.neutral.push(type)
  })

  return matchups
}

/** 返回攻击某个防御属性时的属性对象，并按伤害倍率分组。 */
export function getDefenseMatchups(defenderName) {
  const defender = normalizeTypeName(defenderName)
  if (!defender) return null

  const matchups = createDefenseMatchups()

  typeNames.forEach((attacker) => {
    const multiplier = getMultiplierByNormalizedNames(attacker, defender)
    const type = typesByName.get(attacker)

    if (multiplier === 2) matchups.weakTo.push(type)
    else if (multiplier === 0.5) matchups.resists.push(type)
    else if (multiplier === 0) matchups.immuneTo.push(type)
    else matchups.neutralTo.push(type)
  })

  return matchups
}
