/**
 * 详情区头部 tabs 组件：Request / Response / Preview。
 * 切换时同步 store.activeTab 与对应面板的 .active 类。
 */

import { setActiveTab, type DetailTab } from '../store'

export function mountTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.detail-tabs .tab')
  const panes = document.querySelectorAll<HTMLElement>('.tab-pane')

  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      const tab = t.dataset.tab as DetailTab | undefined
      if (!tab) return
      tabs.forEach((x) => x.classList.toggle('active', x === t))
      panes.forEach((p) => p.classList.toggle('active', p.dataset.tab === tab))
      setActiveTab(tab)
    })
  })
}
