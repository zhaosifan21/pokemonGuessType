const DEFAULT_REM_SIZE = 16

/**
 * 设置 rem 单位使用的根字号。
 *
 * 项目默认 1rem = 16px。将规则集中在此工具中，后续如需引入特定产品的缩放策略，
 * 无需修改各组件样式。
 */
export function setRemSize(size = DEFAULT_REM_SIZE) {
  if (typeof document === 'undefined') return

  const parsedSize = Number(size)
  if (!Number.isFinite(parsedSize) || parsedSize <= 0) return

  document.documentElement.style.fontSize = `${parsedSize}px`
}

export function initRem() {
  setRemSize(DEFAULT_REM_SIZE)
}

initRem()
