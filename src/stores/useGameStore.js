import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getTypeMultiplier } from '../utils/typeEffectiveness.js'
import {
  attackResultDisplayModes,
  normalizeAttackResultDisplayMode,
} from '../utils/attackResultDisplay.js'
import {
  areTypeCombinationsEqual,
  getRandomTypeCombination,
  normalizeTypeCombination,
} from '../utils/typeCombinations.js'

export const useGameStore = defineStore('game', () => {
  const attackLimit = ref(6)
  const guessLimit = ref(3)
  const attackResultDisplayMode = ref(attackResultDisplayModes.NORMAL)
  const allowPossibleCombinations = ref(false)
  const attackCount = ref(0)
  const guessCount = ref(0)
  const hiddenDefenseTypes = ref([])
  const attackHistory = ref([])
  const guessHistory = ref([])
  const lastAttack = ref(null)
  const lastAction = ref(null)
  const gameEndReason = ref(null)
  const gameStatus = ref('idle')

  const isGamePlaying = computed(() => gameStatus.value === 'playing')
  const isGameFinished = computed(() => ['won', 'lost'].includes(gameStatus.value))
  const remainingAttacks = computed(() => Math.max(0, attackLimit.value - attackCount.value))
  const remainingGuesses = computed(() => Math.max(0, guessLimit.value - guessCount.value))

  function normalizeLimit(value, fallback) {
    const parsedValue = Number(value)
    if (!Number.isFinite(parsedValue)) return fallback

    return Math.min(99, Math.max(1, Math.floor(parsedValue)))
  }

  function initGame() {
    attackLimit.value = normalizeLimit(attackLimit.value, 6)
    guessLimit.value = normalizeLimit(guessLimit.value, 3)
    attackResultDisplayMode.value = normalizeAttackResultDisplayMode(attackResultDisplayMode.value)
    allowPossibleCombinations.value = allowPossibleCombinations.value === true
    attackCount.value = 0
    guessCount.value = 0
    hiddenDefenseTypes.value = getRandomTypeCombination()
    attackHistory.value = []
    guessHistory.value = []
    lastAttack.value = null
    lastAction.value = null
    gameEndReason.value = null
    gameStatus.value = 'playing'
  }

  function endGameAsLostWhenGuessesExhausted() {
    if (guessCount.value >= guessLimit.value) {
      gameEndReason.value = 'guesses-exhausted'
      gameStatus.value = 'lost'
      return true
    }

    return false
  }

  function attack(typeName) {
    if (!isGamePlaying.value || attackCount.value >= attackLimit.value) return null

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

    return result
  }

  function submitGuess(typeNames) {
    if (!isGamePlaying.value || guessCount.value >= guessLimit.value) return null

    const guessedTypes = normalizeTypeCombination(typeNames)
    if (!guessedTypes) return null

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
    } else endGameAsLostWhenGuessesExhausted()

    return result
  }

  function abandonGame() {
    if (!isGamePlaying.value) return false

    gameEndReason.value = 'abandoned'
    lastAction.value = { kind: 'abandon' }
    gameStatus.value = 'lost'

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
    gameEndReason.value = null
    gameStatus.value = 'idle'
  }

  return {
    attackLimit,
    guessLimit,
    attackResultDisplayMode,
    allowPossibleCombinations,
    attackCount,
    guessCount,
    hiddenDefenseTypes,
    attackHistory,
    guessHistory,
    lastAttack,
    lastAction,
    gameEndReason,
    gameStatus,
    isGamePlaying,
    isGameFinished,
    remainingAttacks,
    remainingGuesses,
    initGame,
    attack,
    submitGuess,
    abandonGame,
    exitGame,
  }
})
