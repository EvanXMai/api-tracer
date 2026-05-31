/**
 * 顶部条：logo + 搜索 + 筛选 + 已读 + 清空 + 配置。
 * 仅负责事件绑定与 store 联动；视觉/布局放在 CSS。
 */

import { clearAll, markAllRead, setFilter } from '../store'
import { mountFilterMenu } from './filter-menu'
import { openSettingsDialog } from './settings-dialog'

export function mountTopbar(): void {
  const search = document.getElementById('search') as HTMLInputElement
  const markRead = document.getElementById('mark-read') as HTMLButtonElement
  const clear = document.getElementById('clear') as HTMLButtonElement
  const settings = document.getElementById('settings') as HTMLButtonElement
  const filterBtn = document.getElementById('filter') as HTMLButtonElement
  const filterMenu = document.getElementById('filter-menu') as HTMLUListElement

  search.addEventListener('input', () => {
    setFilter(search.value.trim().toLowerCase())
  })
  markRead.addEventListener('click', () => markAllRead())
  clear.addEventListener('click', () => clearAll())
  settings.addEventListener('click', () => openSettingsDialog())

  mountFilterMenu({ trigger: filterBtn, menu: filterMenu })
}
