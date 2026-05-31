/**
 * 详情区编排：
 * - 监听 selectedId / activeTab 变化
 * - 切换 detail 容器与 splitter 显隐
 * - 调度 Request / Response / Preview 三个子面板
 */

import { findRecord, on, setSelectedId, state } from '../store'
import { mountTabs } from './tabs'
import { renderPreviewPane } from './pane-preview'
import { renderRequestPane } from './pane-request'
import { renderResponsePane } from './pane-response'
import { relayoutForDetailHidden, relayoutForDetailVisible } from './splitter'

export function mountDetail(): void {
  const detail = document.getElementById('detail-pane') as HTMLElement
  const splitter = document.getElementById('splitter') as HTMLElement
  const close = document.getElementById('detail-close') as HTMLButtonElement
  const paneRequest = document.getElementById('pane-request') as HTMLElement
  const paneResponse = document.getElementById('pane-response') as HTMLElement
  const panePreview = document.getElementById('pane-preview') as HTMLElement

  mountTabs()

  close.addEventListener('click', () => setSelectedId(null))

  const renderActivePane = (): void => {
    const r = findRecord(state.selectedId)
    if (!r) return
    if (state.activeTab === 'request') renderRequestPane(paneRequest, r)
    else if (state.activeTab === 'response') renderResponsePane(paneResponse, r)
    else renderPreviewPane(panePreview, r)
  }

  const renderDetail = (): void => {
    const r = findRecord(state.selectedId)
    if (!r) {
      detail.classList.add('hidden')
      splitter.classList.add('hidden')
      relayoutForDetailHidden()
      return
    }
    detail.classList.remove('hidden')
    splitter.classList.remove('hidden')
    relayoutForDetailVisible()
    renderActivePane()
  }

  on('detail', renderDetail)
  on('pane', renderActivePane)
  renderDetail()
}
