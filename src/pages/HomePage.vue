<template>
  <section class="home-page" aria-labelledby="game-title">
    <header class="game-hero">
      <p class="eyebrow">TYPE DETECTIVE</p>
      <h1 id="game-title">宝可梦猜属性</h1>
      <p>{{ statusDescription }}</p>
    </header>

    <section
      v-if="!isGamePlaying"
      class="game-panel game-panel--setup"
      aria-labelledby="setup-title"
    >
      <h2 id="setup-title">{{ isGameFinished ? '准备下一局' : '本局配置' }}</h2>
      <div class="limit-grid">
        <label class="limit-field" for="attack-limit">
          <span>攻击次数</span>
          <VanStepper id="attack-limit" v-model="attackLimit" :min="3" :max="99" />
        </label>
        <label class="limit-field" for="guess-limit">
          <span>猜测次数</span>
          <VanStepper id="guess-limit" v-model="guessLimit" :min="1" :max="99" />
        </label>
      </div>
      <fieldset class="display-mode-field">
        <legend>攻击结果显示模式</legend>
        <VanRadioGroup v-model="attackResultDisplayMode">
          <VanRadio
            class="display-mode-option"
            :class="{ 'display-mode-option--selected': attackResultDisplayMode === 'normal' }"
            name="normal"
          >
            <span class="display-mode-option__content">
              <strong>常规模式</strong>
              <small>仅区分效果绝佳、有效果、效果不好与没有效果。</small>
            </span>
          </VanRadio>
          <VanRadio
            class="display-mode-option"
            :class="{ 'display-mode-option--selected': attackResultDisplayMode === 'champions' }"
            name="champions"
          >
            <span class="display-mode-option__content">
              <strong>宝冠军模式（Pokémon Champions）</strong>
              <small>额外区分 4× 的“效果无比绝佳”和 0.25× 的“效果相当不好”。</small>
            </span>
          </VanRadio>
          <VanRadio
            class="display-mode-option"
            :class="{ 'display-mode-option--selected': attackResultDisplayMode === 'multiplier' }"
            name="multiplier"
          >
            <span class="display-mode-option__content">
              <strong>直接显示倍率</strong>
              <small>直接显示造成的伤害倍率。</small>
            </span>
          </VanRadio>
        </VanRadioGroup>
      </fieldset>
      <fieldset class="possible-combinations-field">
        <legend class="mb-10">允许查看合理的属性组合</legend>
        <VanRadioGroup v-model="allowPossibleCombinations" direction="horizontal">
          <VanRadio :name="true">是</VanRadio>
          <VanRadio :name="false">否</VanRadio>
        </VanRadioGroup>
      </fieldset>
      <VanButton type="primary" block @click="startGame">
        {{ isGameFinished ? '再来一局' : '开始游戏' }}
      </VanButton>
    </section>

    <section class="game-panel game-status" aria-live="polite">
      <div>
        <span class="game-status__label">游戏状态</span>
        <strong>{{ statusTitle }}</strong>
      </div>
      <div v-if="isGamePlaying" class="attempt-counters">
        <span>攻击 {{ attackCount }} / {{ attackLimit }}</span>
        <span>猜测 {{ guessCount }} / {{ guessLimit }}</span>
      </div>
      <div v-else-if="isGameFinished" class="answer-types" aria-label="本局答案">
        <span>答案：</span>
        <TypeBadge
          v-for="typeName in hiddenDefenseTypes"
          :key="typeName"
          :type="getType(typeName)"
          class="answer-type"
        />
      </div>
    </section>
    <section v-if="attackHistory.length" class="game-panel attack-log" aria-labelledby="log-title">
      <div class="section-heading">
        <h2 id="log-title">攻击记录</h2>
        <span>{{ attackHistory.length }} 次</span>
      </div>
      <ol>
        <li
          v-for="(attack, index) in attackHistory"
          :key="`${attack.typeName}-${index}`"
          class="attack-log__item"
          :style="getAttackRecordStyle(attack.typeName)"
        >
          <TypeIcon :type="getType(attack.typeName)" :size="18" />
          <div class="attack-log__content">
            <span>第{{ index + 1 }}回合</span>
            <strong>用【{{ getType(attack.typeName).nameCHS }}】属性攻击</strong>
            <em :class="`multiplier-text--${attack.multiplier}`">{{
              getAttackResultText(attack.multiplier, attack.displayMode)
            }}</em>
          </div>
        </li>
      </ol>
    </section>
    <section
      v-if="guessHistory.length"
      class="game-panel guess-log"
      aria-labelledby="guess-log-title"
    >
      <div class="section-heading">
        <h2 id="guess-log-title">猜测记录</h2>
        <span>{{ guessHistory.length }} 次</span>
      </div>
      <ol>
        <li v-for="(guess, index) in guessHistory" :key="`${guess.types.join('-')}-${index}`">
          <span class="guess-log__index">第{{ index + 1 }}次</span>
          <span class="guess-log__types">
            <TypeBadge
              v-for="typeName in guess.types"
              :key="typeName"
              :type="getType(typeName)"
              class="guess-log__type"
            />
          </span>
          <strong
            :class="guess.isCorrect ? 'guess-log__result--correct' : 'guess-log__result--miss'"
          >
            {{ guess.isCorrect ? '猜测正确' : '未命中' }}
          </strong>
        </li>
      </ol>
    </section>
    <section v-if="isGamePlaying" class="game-panel" aria-labelledby="attack-title">
      <div class="section-heading">
        <div>
          <p class="section-heading__eyebrow">STEP 1</p>
          <h2 id="attack-title">选择攻击属性</h2>
        </div>
        <span class="remaining-count">剩余 {{ remainingAttacks }} 次</span>
      </div>
      <div class="type-grid" role="list" aria-label="攻击属性列表">
        <button
          v-for="type in gridTypes"
          :key="type.name"
          class="type-choice"
          :class="{ 'type-choice--selected': selectedAttackName === type.name }"
          :style="{ '--type-color': type.color }"
          type="button"
          :aria-pressed="selectedAttackName === type.name"
          @click="selectedAttackName = type.name"
        >
          <TypeIcon :type="type" :size="20" />
          <span>{{ type.nameCHS }}</span>
        </button>
      </div>
      <div class="action-row">
        <p
          v-if="lastAttack"
          class="multiplier-result"
          :class="`multiplier-result--${lastAttack.multiplier}`"
        >
          上次攻击：{{ getType(lastAttack.typeName).nameCHS }}造成
          {{ formatMultiplier(lastAttack.multiplier) }} 伤害
        </p>
        <VanButton type="primary" :disabled="!canSubmitAttack" @click="submitAttack">
          确定攻击
        </VanButton>
      </div>
    </section>

    <section v-if="isGamePlaying" class="game-panel" aria-labelledby="guess-title">
      <div class="section-heading">
        <div>
          <p class="section-heading__eyebrow">STEP 2</p>
          <h2 id="guess-title">猜测防御属性</h2>
        </div>
        <span class="remaining-count">可选 {{ selectedGuessNames.length }} / 2</span>
      </div>
      <p class="section-hint">选择一个或两个属性；双属性的顺序不影响答案。</p>
      <div class="type-grid" role="list" aria-label="猜测属性列表">
        <button
          v-for="type in gridTypes"
          :key="type.name"
          class="type-choice"
          :class="{
            'type-choice--selected': selectedGuessNames.includes(type.name),
            'type-choice--disabled':
              selectedGuessNames.length === 2 && !selectedGuessNames.includes(type.name),
          }"
          :style="{ '--type-color': type.color }"
          type="button"
          :disabled="selectedGuessNames.length === 2 && !selectedGuessNames.includes(type.name)"
          :aria-pressed="selectedGuessNames.includes(type.name)"
          @click="toggleGuess(type.name)"
        >
          <TypeIcon :type="type" :size="20" />
          <span>{{ type.nameCHS }}</span>
        </button>
      </div>
      <div class="action-row">
        <div class="selected-types" aria-live="polite">
          <span v-if="selectedGuessTypes.length === 0">尚未选择属性</span>
          <TypeBadge
            v-for="type in selectedGuessTypes"
            :key="type.name"
            :type="type"
            :icon-size="16"
            class="selected-type"
          />
        </div>
        <VanButton plain :disabled="!canSubmitGuess" @click="submitGuess">提交猜测</VanButton>
      </div>
      <VanButton
        v-if="allowPossibleCombinations"
        class="possible-combinations-trigger"
        plain
        block
        @click="isPossibleCombinationsVisible = true"
      >
        查看剩余组合（{{ possibleTypeCombinations.length }}）
      </VanButton>
    </section>

    <div v-if="isGamePlaying" class="game-exit-actions" aria-label="游戏控制">
      <VanButton plain type="default" @click="exitGame">退出游戏</VanButton>
      <VanButton plain type="danger" @click="abandonGame">放弃游戏</VanButton>
    </div>

    <VanPopup
      v-model:show="isPossibleCombinationsVisible"
      class="possible-combinations-popup"
      position="bottom"
      round
      closeable
    >
      <section class="possible-combinations-dialog" aria-labelledby="possible-combinations-title">
        <header>
          <div>
            <p>推理辅助</p>
            <h2 id="possible-combinations-title">剩余合理组合</h2>
          </div>
          <strong>{{ possibleTypeCombinations.length }} 种</strong>
        </header>
        <p class="possible-combinations-dialog__hint">结果会随着攻击与猜测记录实时更新。</p>
        <div class="possible-combinations-dialog__body">
          <section v-if="possibleSingleTypeCombinations.length" class="possible-combinations-group">
            <h3>单属性（{{ possibleSingleTypeCombinations.length }}）</h3>
            <div class="possible-combinations-list">
              <TypeBadge
                v-for="[typeName] in possibleSingleTypeCombinations"
                :key="typeName"
                :type="getType(typeName)"
              />
            </div>
          </section>
          <section v-if="possibleDualTypeCombinations.length" class="possible-combinations-group">
            <h3>双属性（{{ possibleDualTypeCombinations.length }}）</h3>
            <div class="possible-combinations-list possible-combinations-list--dual">
              <span
                v-for="combination in possibleDualTypeCombinations"
                :key="combination.join('|')"
                class="type-combination-badge"
              >
                <TypeBadge
                  v-for="typeName in combination"
                  :key="typeName"
                  :type="getType(typeName)"
                />
              </span>
            </div>
          </section>
        </div>
      </section>
    </VanPopup>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  Button as VanButton,
  Radio as VanRadio,
  RadioGroup as VanRadioGroup,
  Popup as VanPopup,
  Stepper as VanStepper,
} from 'vant'
import types from '../assets/json/types.json' with { type: 'json' }
import TypeBadge from '../components/TypeBadge.vue'
import TypeIcon from '../components/TypeIcon.vue'
import { useGameStore } from '../stores/useGameStore'
import { getAttackResultText } from '../utils/attackResultDisplay.js'
import { getPossibleTypeCombinations } from '../utils/typePossibilities.js'

const gameStore = useGameStore()
const {
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
} = storeToRefs(gameStore)

const selectedAttackName = ref('')
const selectedGuessNames = ref([])
const isPossibleCombinationsVisible = ref(false)
const typeByName = new Map(types.map((type) => [type.name, type]))
const gridTypeNames = [
  'Normal',
  'Flying',
  'Fire',
  'Psychic',
  'Water',
  'Bug',
  'Electric',
  'Rock',
  'Grass',
  'Ghost',
  'Ice',
  'Dragon',
  'Fighting',
  'Dark',
  'Poison',
  'Steel',
  'Ground',
  'Fairy',
]
const gridTypes = gridTypeNames.map((typeName) => typeByName.get(typeName))

const selectedAttack = computed(() => typeByName.get(selectedAttackName.value) ?? null)
const selectedGuessTypes = computed(() =>
  selectedGuessNames.value.map((typeName) => typeByName.get(typeName)),
)
const possibleTypeCombinations = computed(() =>
  getPossibleTypeCombinations(attackHistory.value, guessHistory.value),
)
const possibleSingleTypeCombinations = computed(() =>
  possibleTypeCombinations.value.filter((combination) => combination.length === 1),
)
const possibleDualTypeCombinations = computed(() =>
  possibleTypeCombinations.value.filter((combination) => combination.length === 2),
)
const canSubmitAttack = computed(
  () => isGamePlaying.value && Boolean(selectedAttack.value) && remainingAttacks.value > 0,
)
const canSubmitGuess = computed(
  () => isGamePlaying.value && selectedGuessNames.value.length > 0 && remainingGuesses.value > 0,
)
const statusTitle = computed(() => {
  if (gameStatus.value === 'won') return '猜对了！'
  if (gameStatus.value === 'lost') return '本局结束'
  if (lastAction.value?.kind === 'guess') return `第${guessCount.value}次猜测未命中`
  if (lastAction.value?.kind === 'attack') return `第${attackCount.value}回合攻击完成`
  if (isGamePlaying.value) return '正在分析属性组合'
  return '准备开始挑战'
})
const statusDescription = computed(() => {
  if (gameStatus.value === 'won') return '你成功锁定了隐藏的防御属性组合。'
  if (gameStatus.value === 'lost') {
    return gameEndReason.value === 'abandoned'
      ? '你已放弃本局，答案已揭晓。'
      : '次数已用尽，答案已揭晓。'
  }
  if (lastAction.value?.kind === 'guess') return '继续分析倍率，或调整属性组合后再次猜测。'
  if (lastAction.value?.kind === 'attack') return '攻击结果已记录，你可以继续攻击或提交猜测。'
  if (isGamePlaying.value) return '选择一种攻击属性，观察它对隐藏组合造成的倍率。'
  return '设定本局次数后，系统会随机生成一个隐藏属性组合。'
})

function resetSelections() {
  selectedAttackName.value = ''
  selectedGuessNames.value = []
  isPossibleCombinationsVisible.value = false
}

function startGame() {
  resetSelections()
  gameStore.initGame()
}

function submitAttack() {
  if (!canSubmitAttack.value) return

  gameStore.attack(selectedAttackName.value)
  selectedAttackName.value = ''
}

function toggleGuess(typeName) {
  if (!isGamePlaying.value) return

  const selectedIndex = selectedGuessNames.value.indexOf(typeName)
  if (selectedIndex >= 0) {
    selectedGuessNames.value.splice(selectedIndex, 1)
    return
  }

  if (selectedGuessNames.value.length < 2) selectedGuessNames.value.push(typeName)
}

function submitGuess() {
  if (!canSubmitGuess.value) return

  gameStore.submitGuess(selectedGuessNames.value)
  selectedGuessNames.value = []
}

function abandonGame() {
  resetSelections()
  gameStore.abandonGame()
}

function exitGame() {
  resetSelections()
  gameStore.exitGame()
}

function getType(typeName) {
  return typeByName.get(typeName)
}

function formatMultiplier(multiplier) {
  return `${multiplier}×`
}

function getAttackRecordStyle(typeName) {
  return {
    '--record-color': getType(typeName).color,
    backgroundColor: `${getType(typeName).color}`,
  }
}
</script>