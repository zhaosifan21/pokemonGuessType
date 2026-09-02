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
import { useGameStore } from '../src/stores/useGameStore.js'

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

test('错误猜测发生且攻击次数剩余一次时生成攻击提示，攻击后清除', () => {
  const store = startGameStore({ attackLimit: 3, guessLimit: 3 })
  store.attack('Normal')
  store.submitGuess(['Fire'])

  assert.equal(store.attackHintText, null)

  store.attack('Fighting')
  const result = store.submitGuess(['Grass'])

  assert.equal(result.isCorrect, false)
  assert.equal(typeof store.attackHintText, 'string')
  assert.doesNotMatch(store.attackHintText, /【一般】|【格斗】/)
  assert.equal(store.remainingAttacks, 1)
  assert.equal(store.attack('Grass')?.typeName, 'Grass')
  assert.equal(store.attackHintText, null)
})

test('猜测次数只剩一次时，攻击后根据最新记录生成下一次攻击提示', () => {
  const store = startGameStore({ attackLimit: 3, guessLimit: 3 })
  store.submitGuess(['Fire'])
  store.submitGuess(['Grass'])

  assert.equal(store.remainingGuesses, 1)
  assert.equal(store.attackHintText, null)

  store.attack('Normal')
  assert.equal(store.remainingAttacks, 2)
  assert.equal(typeof store.attackHintText, 'string')
  assert.doesNotMatch(store.attackHintText, /【一般】/)

  store.attack('Fighting')
  assert.equal(store.remainingAttacks, 1)
  assert.equal(typeof store.attackHintText, 'string')
  assert.doesNotMatch(store.attackHintText, /【一般】|【格斗】/)

  store.attack('Grass')
  assert.equal(store.remainingAttacks, 0)
  assert.equal(store.attackHintText, null)
})

test('猜测次数多于一次或关闭文字提示时，攻击后不补充攻击提示', () => {
  const normalStore = startGameStore({ attackLimit: 3, guessLimit: 3 })
  normalStore.submitGuess(['Fire'])
  normalStore.attack('Normal')
  assert.equal(normalStore.remainingGuesses, 2)
  assert.equal(normalStore.attackHintText, null)

  const disabledStore = startGameStore({
    attackLimit: 3,
    guessLimit: 3,
    showTextHints: false,
  })
  disabledStore.submitGuess(['Fire'])
  disabledStore.submitGuess(['Grass'])
  disabledStore.attack('Normal')
  assert.equal(disabledStore.remainingGuesses, 1)
  assert.equal(disabledStore.attackHintText, null)
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
