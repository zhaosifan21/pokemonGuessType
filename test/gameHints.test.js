import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { attackResultDisplayModes } from '../src/utils/attackResultDisplay.js'
import {
  createAttackHintText,
  createGuessHintText,
  getExpectedAttackEliminations,
  getGuessTypeRecommendation,
  getHintTypeCount,
  getRecommendedAttackType,
} from '../src/utils/gameHints.js'
import { gameConfigStorageKey, useGameStore } from '../src/stores/useGameStore.js'

function createSequenceRandom(...values) {
  let index = 0

  return () => {
    const value = values[index] ?? values.at(-1) ?? 0
    index += 1
    return value
  }
}

function startGameStore({ attackLimit = 3, guessLimit = 3, showTextHints = true } = {}) {
  setActivePinia(createPinia())
  const store = useGameStore()
  store.attackLimit = attackLimit
  store.guessLimit = guessLimit
  store.showTextHints = showTextHints
  store.initGame()
  store.hiddenDefenseTypes = ['Water']
  return store
}

function createMemoryStorage() {
  const values = new Map()

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, String(value))
    },
  }
}

test('攻击推荐选择期望排除组合数最高的属性', () => {
  const possibleCombinations = [['Grass'], ['Bug'], ['Water'], ['Rock']]

  assert.equal(
    getExpectedAttackEliminations('Fire', possibleCombinations, attackResultDisplayModes.NORMAL),
    2,
  )
  assert.equal(
    getExpectedAttackEliminations(
      'Electric',
      possibleCombinations,
      attackResultDisplayModes.NORMAL,
    ),
    2.5,
  )
  assert.equal(
    getRecommendedAttackType({
      possibleCombinations,
      availableAttackTypeNames: ['Fire', 'Electric'],
      displayMode: attackResultDisplayModes.NORMAL,
    }),
    'Electric',
  )
})

test('攻击推荐按照玩家可见的结果模式分桶', () => {
  const possibleCombinations = [['Grass'], ['Grass', 'Bug']]

  assert.equal(
    getExpectedAttackEliminations('Fire', possibleCombinations, attackResultDisplayModes.NORMAL),
    0,
  )
  assert.equal(
    getExpectedAttackEliminations('Fire', possibleCombinations, attackResultDisplayModes.CHAMPIONS),
    1,
  )
})

test('候选只剩一个时从可用攻击属性中随机推荐', () => {
  assert.equal(
    getRecommendedAttackType({
      possibleCombinations: [['Water']],
      availableAttackTypeNames: ['Fire', 'Electric'],
      displayMode: attackResultDisplayModes.NORMAL,
      random: () => 0.99,
    }),
    'Electric',
  )
  assert.match(
    createAttackHintText({
      possibleCombinations: [['Water']],
      availableAttackTypeNames: ['Fire'],
      displayMode: attackResultDisplayModes.NORMAL,
      random: () => 0,
    }),
    /【火】/,
  )
})

test('提示属性数量遵循 80% / 15% / 5% 的边界', () => {
  assert.equal(
    getHintTypeCount(() => 0.799),
    1,
  )
  assert.equal(
    getHintTypeCount(() => 0.8),
    2,
  )
  assert.equal(
    getHintTypeCount(() => 0.949),
    2,
  )
  assert.equal(
    getHintTypeCount(() => 0.95),
    3,
  )
})

test('猜测提示能够随机选择多个不可能属性', () => {
  const recommendation = getGuessTypeRecommendation({
    possibleCombinations: [['Fire'], ['Fire', 'Ice']],
    typeNames: ['Fire', 'Ice', 'Water', 'Grass'],
    random: createSequenceRandom(0.1, 0.9, 0, 0),
  })

  assert.deepEqual(recommendation, {
    kind: 'avoid',
    typeNames: ['Water', 'Grass'],
  })
  assert.match(
    createGuessHintText({
      possibleCombinations: [['Fire']],
      typeNames: ['Fire', 'Ice', 'Water'],
      random: createSequenceRandom(0.1, 0.9, 0, 0, 0),
    }),
    /【冰】和【水】/,
  )
})

test('排除属性提示只在玩家已猜过全部相关属性时使用“再”', () => {
  const options = {
    possibleCombinations: [['Fire']],
    typeNames: ['Fire', 'Ice'],
  }

  const untriedHint = createGuessHintText({
    ...options,
    random: createSequenceRandom(0.1, 0.1, 0, 0.99),
  })
  const retriedHint = createGuessHintText({
    ...options,
    previouslyGuessedTypeNames: ['Ice'],
    random: createSequenceRandom(0.1, 0.1, 0, 0),
  })

  assert.match(untriedHint, /【冰】/)
  assert.doesNotMatch(untriedHint, /再|已经猜过|已经试过/)
  assert.match(retriedHint, /【冰】/)
  assert.match(retriedHint, /再|已经猜过|已经试过/)
})

test('高概率多属性提示应用包含边界的 70% 门槛', () => {
  const possibleCombinations = [
    ['Fire'],
    ['Fire', 'Ice'],
    ['Fire', 'Dragon'],
    ['Fire', 'Water'],
    ['Fire', 'Grass'],
    ['Fire', 'Rock'],
    ['Fire', 'Bug'],
    ['Fire', 'Steel'],
    ['Fire', 'Fairy'],
    ['Fire', 'Normal'],
    ['Ice'],
    ['Ice', 'Water'],
    ['Ice', 'Grass'],
    ['Ice', 'Rock'],
    ['Ice', 'Bug'],
    ['Ice', 'Steel'],
    ['Dragon'],
    ['Dragon', 'Water'],
    ['Dragon', 'Grass'],
    ['Dragon', 'Rock'],
    ['Dragon', 'Bug'],
  ]

  const recommendation = getGuessTypeRecommendation({
    possibleCombinations,
    typeNames: ['Fire', 'Ice', 'Dragon'],
    random: createSequenceRandom(0.9, 0, 0),
  })

  assert.deepEqual(recommendation, {
    kind: 'prefer',
    typeNames: ['Fire', 'Ice'],
  })
})

test('倒数第二次攻击后生成攻击提示，并持续到游戏结束', () => {
  const store = startGameStore({ attackLimit: 3, guessLimit: 3 })
  store.attack('Normal')
  assert.equal(store.attackHintText, null)

  store.attack('Fighting')
  assert.equal(typeof store.attackHintText, 'string')
  assert.doesNotMatch(store.attackHintText, /【一般】|【格斗】/)
  assert.equal(store.remainingAttacks, 1)
  const hintText = store.attackHintText

  store.submitGuess(['Fire'])
  assert.equal(store.attackHintText, hintText)

  store.attack('Grass')
  assert.equal(store.remainingAttacks, 0)
  assert.equal(store.attackHintText, hintText)

  store.submitGuess(['Grass'])
  assert.equal(store.attackHintText, hintText)
  store.submitGuess(['Ice'])
  assert.equal(store.gameStatus, 'lost')
  assert.equal(store.attackHintText, null)
})

test('攻击提示与猜测次数无关，关闭文字提示时不生成', () => {
  const normalStore = startGameStore({ attackLimit: 3, guessLimit: 3 })
  normalStore.attack('Normal')
  assert.equal(normalStore.attackHintText, null)
  normalStore.attack('Fighting')
  assert.equal(typeof normalStore.attackHintText, 'string')

  const disabledStore = startGameStore({
    attackLimit: 3,
    guessLimit: 3,
    showTextHints: false,
  })
  disabledStore.attack('Normal')
  disabledStore.attack('Fighting')
  assert.equal(disabledStore.remainingAttacks, 1)
  assert.equal(disabledStore.attackHintText, null)
})

test('错误猜测不会补充或改写攻击提示', () => {
  const store = startGameStore({ attackLimit: 3, guessLimit: 3 })
  store.submitGuess(['Fire'])
  assert.equal(store.attackHintText, null)
})

for (const [guessLimit, guessesBeforeHint] of [
  [3, 2],
  [4, 2],
  [5, 3],
]) {
  test(`猜测次数配置为 ${guessLimit} 时在正确节点生成一次持久提示`, () => {
    const store = startGameStore({ guessLimit })
    const wrongGuesses = ['Fire', 'Grass', 'Ice', 'Dragon']

    wrongGuesses.slice(0, guessesBeforeHint - 1).forEach((typeName) => {
      store.submitGuess([typeName])
      assert.equal(store.guessHintText, null)
    })

    store.submitGuess([wrongGuesses[guessesBeforeHint - 1]])
    const hintText = store.guessHintText

    assert.equal(typeof hintText, 'string')
    assert.equal(store.remainingGuesses, Math.floor(guessLimit / 2))

    if (store.remainingGuesses > 1) {
      store.submitGuess([wrongGuesses[guessesBeforeHint]])
      assert.equal(store.guessHintText, hintText)
    } else {
      store.submitGuess([wrongGuesses[guessesBeforeHint]])
      assert.equal(store.gameStatus, 'lost')
      assert.equal(store.guessHintText, null)
    }
  })
}

test('猜测次数为一时不生成提示，且游戏结束会清空提示', () => {
  const store = startGameStore({ guessLimit: 1 })

  store.submitGuess(['Fire'])

  assert.equal(store.gameStatus, 'lost')
  assert.equal(store.guessHintText, null)
  assert.equal(store.attackHintText, null)
})

test('关闭提示、重复猜测和正确猜测均不会生成提示', () => {
  const disabledStore = startGameStore({ guessLimit: 3, showTextHints: false })
  disabledStore.submitGuess(['Fire'])
  disabledStore.submitGuess(['Grass'])
  assert.equal(disabledStore.guessHintText, null)

  const duplicateStore = startGameStore({ guessLimit: 3 })
  duplicateStore.submitGuess(['Fire'])
  assert.equal(duplicateStore.submitGuess(['Fire']), null)
  assert.equal(duplicateStore.guessCount, 1)
  assert.equal(duplicateStore.guessHintText, null)

  const winningStore = startGameStore({ guessLimit: 3 })
  winningStore.submitGuess(['Water'])
  assert.equal(winningStore.gameStatus, 'won')
  assert.equal(winningStore.guessHintText, null)
  assert.equal(winningStore.attackHintText, null)
})

test('开始游戏后缓存配置，并在新的 store 中安全恢复', () => {
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = createMemoryStorage()

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  })

  try {
    setActivePinia(createPinia())
    const store = useGameStore()
    store.attackLimit = 12
    store.guessLimit = 5
    store.attackResultDisplayMode = attackResultDisplayModes.CHAMPIONS
    store.allowPossibleCombinations = true
    store.showTextHints = true
    store.initGame()

    assert.deepEqual(JSON.parse(storage.getItem(gameConfigStorageKey)), {
      attackLimit: 12,
      guessLimit: 5,
      attackResultDisplayMode: attackResultDisplayModes.CHAMPIONS,
      allowPossibleCombinations: true,
      showTextHints: true,
    })

    setActivePinia(createPinia())
    const restoredStore = useGameStore()
    assert.equal(restoredStore.attackLimit, 12)
    assert.equal(restoredStore.guessLimit, 5)
    assert.equal(restoredStore.attackResultDisplayMode, attackResultDisplayModes.CHAMPIONS)
    assert.equal(restoredStore.allowPossibleCombinations, true)
    assert.equal(restoredStore.showTextHints, true)

    storage.setItem(gameConfigStorageKey, '{not-valid-json')
    setActivePinia(createPinia())
    const fallbackStore = useGameStore()
    assert.equal(fallbackStore.attackLimit, 6)
    assert.equal(fallbackStore.guessLimit, 3)
  } finally {
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
    } else {
      delete globalThis.window
    }
  }
})
