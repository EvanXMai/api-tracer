/**
 * 请求列表（左侧主区）：根据 store + 筛选模式渲染表格。
 * 点击行 → 选中并打开详情；列表订阅 'list' 通道事件自动刷新。
 */

import type { RequestRecord } from '../../shared/protocol'
import { urlMatchesPrefix } from '../api-prefix'
import {
  bizCell,
  escapeHtml,
  methodPill,
  statusPill,
  urlPath,
} from '../format'
import { on, setSelectedId, state } from '../store'

function passesFilterMode(r: RequestRecord): boolean {
  switch (state.filterMode) {
    case 'success':
      return r.bizOk === true
    case 'fail':
      return r.bizOk === false
    case 'prefix':
      return urlMatchesPrefix(r.url, state.apiPrefixes)
    case 'named':
      return !!r.name && r.name !== '--'
    case 'all':
    default:
      return true
  }
}

function visibleRecords(): RequestRecord[] {
  const f = state.filter
  let list = state.records.filter(passesFilterMode)
  if (f) {
    list = list.filter(
      (r) => r.name.toLowerCase().includes(f) || r.url.toLowerCase().includes(f),
    )
  }
  // 时间升序：早到达在顶部，新到达在底部
  list.sort((a, b) => a.startedAt - b.startedAt)
  return list
}

export function mountRequestList(): void {
  const tbody = document.getElementById('req-tbody') as HTMLTableSectionElement
  const empty = document.getElementById('empty') as HTMLElement

  const render = (): void => {
    const list = visibleRecords()
    empty.classList.toggle('hidden', list.length > 0)
    tbody.innerHTML = ''
    const frag = document.createDocumentFragment()
    for (const r of list) {
      const tr = document.createElement('tr')
      tr.dataset.id = r.id
      if (r.id === state.selectedId) tr.classList.add('selected')

      // 接口名称的高亮逻辑：
      // - 未点击过 (!viewed) 才显示黄色 + 黄点
      // - 第一次进入列表时附加 .blink 类，触发 3 次闪烁动画（CSS 控制时长）
      const isFresh = !r.viewed
      const shouldBlink = isFresh && !state.blinkedIds.has(r.id)
      if (shouldBlink) state.blinkedIds.add(r.id)
      const nameClass =
        'col-name' + (isFresh ? ' fresh' : '') + (shouldBlink ? ' blink' : '')

      tr.innerHTML = `
        <td class="${nameClass}">${escapeHtml(r.name)}</td>
        <td class="col-method">${methodPill(r.method)}</td>
        <td class="col-biz">${bizCell(r.bizOk)}</td>
        <td class="col-status">${statusPill(r.status)}</td>
        <td class="col-url">${escapeHtml(urlPath(r.url))}</td>
      `
      tr.addEventListener('click', () => {
        // 点击 → 标记已查看，恢复橙红色、黄点消失
        r.viewed = true
        state.blinkedIds.delete(r.id)
        setSelectedId(r.id)
      })
      frag.appendChild(tr)
    }
    tbody.appendChild(frag)
  }

  on('list', render)
  render()
}
