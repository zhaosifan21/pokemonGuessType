import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import types from '../assets/json/types.json' with { type: 'json' }
import { getTypeMultiplier } from '../utils/typeEffectiveness.js'
import {
  attackResultDisplayModes,
  normalizeAttackResultDisplayMode,
} from '../utils/attackResultDisplay.js'
import {
  areTypeCombinationsEqual,
  getTypeCombinationKey,
  getRandomTypeCombination,
  normalizeTypeCombination,
} from '../utils/typeCombinations.js'
import { getPossibleTypeCombinations } from '../utils/typePossibilities.js'
import { createAttackHintText, createGuessHintText } from '../utils/gameHints.js'

const allTypeNames = types.map((type) => type.name)
export const gameConfigStorageKey = 'pokemon-guess-type:game-config'

export const useGameStore = defineStore('game', () => {
  const attackLimit = ref(6)
  const guessLimit = ref(3)
  const attackResultDisplayMode = ref(attackResultDisplayModes.NORMAL)
  const allowPossibleCombinations = ref(false)
  const showTextHints = ref(false)
  const attackCount = ref(0)
  const guessCount = ref(0)
  const hiddenDefenseTypes = ref([])
  const attackHistory = ref([])
  const guessHistory = ref([])
  const lastAttack = ref(null)
  const lastAction = ref(null)
  const attackHintText = ref(null)
  const guessHintText = ref(null)
  const gameEndReason = ref(null)
  const gameStatus = ref('idle')

  const isGamePlaying = computed(() => gameStatus.value === 'playing')
  const isGameFinished = computed(() => ['won', 'lost'].includes(gameStatus.value))
  const remainingAttacks = computed(() => Math.max(0, attackLimit.value - attackCount.value))
  const remainingGuesses = computed(() => Math.max(0, guessLimit.value - guessCount.value))
  const possibleTypeCombinations = computed(() =>
    getPossibleTypeCombinations(attackHistory.value, guessHistory.value),
  )

  function normalizeLimit(value, fallback) {
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) return fallback

    return Math.min(99, Math.max(1, Math.floor(parsedValue)))
  }

  function getLocalStorage() {
    if (typeof window === 'undefined') return null

    try {
      return window.localStorage
    } catch {
      return null
    }
  }

  function restoreGameConfig() {
    const storage = getLocalStorage()
    if (!storage) return

    try {
      const storedValue = storage.getItem(gameConfigStorageKey)
      if (!storedValue) return

      const config = JSON.parse(storedValue)
      if (!config || typeof config !== 'object' || Array.isArray(config)) return

      attackLimit.value = Math.min(
        18,
        Math.max(3, normalizeLimit(config.attackLimit, attackLimit.value)),
      )
      guessLimit.value = normalizeLimit(config.guessLimit, guessLimit.value)
      attackResultDisplayMode.value = normalizeAttackResultDisplayMode(
        config.attackResultDisplayMode,
      )
      allowPossibleCombinations.value = config.allowPossibleCombinations === true
      showTextHints.value = config.showTextHints === true
    } catch {
      // localStorage 可能被禁用、配额耗尽或包含损坏数据，此时保留默认配置。
    }
  }

  function saveGameConfig() {
    const storage = getLocalStorage()
    if (!storage) return

    try {
      storage.setItem(
        gameConfigStorageKey,
        JSON.stringify({
          attackLimit: attackLimit.value,
          guessLimit: guessLimit.value,
          attackResultDisplayMode: attackResultDisplayMode.value,
          allowPossibleCombinations: allowPossibleCombinations.value,
          showTextHints: showTextHints.value,
        }),
      )
    } catch {
      // 缓存不可用不应阻止玩家开始游戏。
    }
  }

  function initGame() {
    attackLimit.value = Math.min(18, Math.max(3, normalizeLimit(attackLimit.value, 6)))
    guessLimit.value = normalizeLimit(guessLimit.value, 3)
    attackResultDisplayMode.value = normalizeAttackResultDisplayMode(attackResultDisplayMode.value)
    allowPossibleCombinations.value = allowPossibleCombinations.value === true
    showTextHints.value = showTextHints.value === true
    attackCount.value = 0
    guessCount.value = 0
    hiddenDefenseTypes.value = getRandomTypeCombination()
    attackHistory.value = []
    guessHistory.value = []
    lastAttack.value = null
    lastAction.value = null
    clearGameHints()
    gameEndReason.value = null
    gameStatus.value = 'playing'
    saveGameConfig()
  }

  function endGameAsLostWhenGuessesExhausted() {
    if (guessCount.value >= guessLimit.value) {
      gameEndReason.value = 'guesses-exhausted'
      gameStatus.value = 'lost'
      clearGameHints()
      return true
    }

    return false
  }

  function clearGameHints() {
    attackHintText.value = null
    guessHintText.value = null
  }

  function updateAttackHint() {
    const availableAttackTypeNames = allTypeNames.filter((typeName) => !isAttackTypeUsed(typeName))

    attackHintText.value = createAttackHintText({
      possibleCombinations: possibleTypeCombinations.value,
      availableAttackTypeNames,
      displayMode: attackResultDisplayMode.value,
    })
  }

  function updateHintsAfterIncorrectGuess() {
    if (!showTextHints.value || !isGamePlaying.value) return

    const guessHintTriggerCount = Math.floor(guessLimit.value / 2)
    if (
      guessLimit.value > 1 &&
      remainingGuesses.value === guessHintTriggerCount &&
      !guessHintText.value
    ) {
      guessHintText.value = createGuessHintText({
        possibleCombinations: possibleTypeCombinations.value,
        previouslyGuessedTypeNames: guessHistory.value.flatMap((guessRecord) => guessRecord.types),
      })
    }
  }

  function normalizeAttackTypeName(typeName) {
    return typeof typeName === 'string' ? typeName.trim().toLowerCase() : null
  }

  function isAttackTypeUsed(typeName) {
    const normalizedTypeName = normalizeAttackTypeName(typeName)
    if (!normalizedTypeName) return false

    return attackHistory.value.some(
      (attackRecord) => normalizeAttackTypeName(attackRecord.typeName) === normalizedTypeName,
    )
  }

  function hasGuessedTypeCombination(typeNames) {
    const combinationKey = getTypeCombinationKey(typeNames)
    if (!combinationKey) return false

    return guessHistory.value.some(
      (guessRecord) => getTypeCombinationKey(guessRecord.types) === combinationKey,
    )
  }

  function attack(typeName) {
    if (!isGamePlaying.value || attackCount.value >= attackLimit.value) return null
    if (isAttackTypeUsed(typeName)) return null

    const multiplier = getTypeMultiplier(typeName, hiddenDefenseTypes.value)
    if (multiplier === null) return null

    const result = {
      typeName: typeName.trim(),
      multiplier,
      displayMode: attackResultDisplayMode.value,
    }

    attackCount.value += 1
    lastAttack.value = result
    lastAction.value = { kind: 'attack', ...result }
    attackHistory.value.push(result)

    if (showTextHints.value && remainingAttacks.value === 1) {
      updateAttackHint()
    }

    return result
  }

  function submitGuess(typeNames) {
    if (!isGamePlaying.value || guessCount.value >= guessLimit.value) return null

    const guessedTypes = normalizeTypeCombination(typeNames)
    if (!guessedTypes) return null
    if (hasGuessedTypeCombination(guessedTypes)) return null

    const isCorrect = areTypeCombinationsEqual(guessedTypes, hiddenDefenseTypes.value)
    const result = {
      types: guessedTypes,
      isCorrect,
    }

    guessCount.value += 1
    guessHistory.value.push(result)
    lastAction.value = { kind: 'guess', ...result }

    if (isCorrect) {
      gameEndReason.value = 'guessed-correctly'
      gameStatus.value = 'won'
      clearGameHints()
    } else if (!endGameAsLostWhenGuessesExhausted()) updateHintsAfterIncorrectGuess()

    return result
  }

  function abandonGame() {
    if (!isGamePlaying.value) return false

    gameEndReason.value = 'abandoned'
    lastAction.value = { kind: 'abandon' }
    gameStatus.value = 'lost'
    clearGameHints()

    return true
  }

  function exitGame() {
    attackCount.value = 0
    guessCount.value = 0
    hiddenDefenseTypes.value = []
    attackHistory.value = []
    guessHistory.value = []
    lastAttack.value = null
    lastAction.value = null
    clearGameHints()
    gameEndReason.value = null
    gameStatus.value = 'idle'
  }

  restoreGameConfig()

  return {
    attackLimit,
    guessLimit,
    attackResultDisplayMode,
    allowPossibleCombinations,
    showTextHints,
    attackCount,
    guessCount,
    hiddenDefenseTypes,
    attackHistory,
    guessHistory,
    lastAttack,
    lastAction,
    attackHintText,
    guessHintText,
    gameEndReason,
    gameStatus,
    isGamePlaying,
    isGameFinished,
    remainingAttacks,
    remainingGuesses,
    possibleTypeCombinations,
    isAttackTypeUsed,
    hasGuessedTypeCombination,
    initGame,
    attack,
    submitGuess,
    abandonGame,
    exitGame,
  }
})
