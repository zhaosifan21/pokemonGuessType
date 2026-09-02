<script setup>
import { computed } from 'vue'
import typeSpriteUrl from '../assets/images/types.webp'

const props = defineProps({
  type: {
    type: Object,
    required: true,
  },
  size: {
    type: Number,
    default: 20,
  },
})

const spriteStyle = computed(() => {
  const size = Math.max(1, props.size)

  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url(${typeSpriteUrl})`,
    backgroundSize: `${size}px auto`,
    backgroundPosition: `0 ${props.type.icon.index * size * -1}px`,
  }
})
</script>

<template>
  <span class="type-icon" :style="spriteStyle" aria-hidden="true"></span>
</template>
