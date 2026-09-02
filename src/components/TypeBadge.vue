<script setup>
import TypeIcon from './TypeIcon.vue'

defineProps({
  type: {
    type: Object,
    required: true,
  },
  iconSize: {
    type: Number,
    default: 18,
  },
})
</script>

<template>
  <span class="type-badge" :style="{ '--type-color': type.color }">
    <TypeIcon :type="type" :size="iconSize" />
    <span class="type-badge__label">{{ type.nameCHS }}</span>
  </span>
</template>

<style scoped lang="less">
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--type-color);
  box-shadow: inset 0 -1px rgba(0, 0, 0, 0.16);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.28);
  white-space: nowrap;
}

.type-badge .type-icon {
  flex: 0 0 auto;
}

.type-badge__label {
  width: 2.4em;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
}
</style>
