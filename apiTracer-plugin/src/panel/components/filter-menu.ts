/**
 * 筛选下拉菜单：5 种模式（全部 / 成功 / 失败 / 前缀 api / 有接口名称）。
 * 与按钮按 ARIA 配合，按钮上 .active 表示当前不是默认 'all'。
 */

import { setFilterMode, state, type FilterMode } from '../store'

export function mountFilterMenu(opts: {
  trigger: HTMLButtonElement
  menu: HTMLUListElement
}): void {
  const { trigger, menu } = opts

  const setOpen = (open: boolean): void => {
    menu.classList.toggle('hidden', !open)
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
  }

  const choose = (mode: FilterMode): void => {
    setFilterMode(mode)
    trigger.classList.toggle('active', mode !== 'all')
    menu.querySelectorAll('li').forEach((li) => {
      li.classList.toggle('active', li.dataset.value === mode)
    })
    setOpen(false)
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation()
    setOpen(menu.classList.contains('hidden'))
  })

  menu.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('li')
    if (!target) return
    const value = target.dataset.value as FilterMode | undefined
    if (!value) return
    choose(value)
  })

  // 点击空白处 / Esc 关闭
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('hidden')) return
    const t = e.target as Node
    if (trigger.contains(t) || menu.contains(t)) return
    setOpen(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.classList.contains('hidden')) setOpen(false)
  })

  // 初始同步当前模式（默认为 'all'）
  choose(state.filterMode)
}
