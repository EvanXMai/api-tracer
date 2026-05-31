/**
 * 面板共享状态 + 极简事件总线。
 * - 状态全部为模块内可变变量，组件通过 import 直接读取
 * - 写操作通过 actions 暴露，统一触发 emit，避免组件互相传引用
 */

import type { RequestRecord } from '../shared/protocol'
import type { SuccessFnItem } from './storage'

export type FilterMode = 'all' | 'success' | 'fail' | 'prefix' | 'named'
export type DetailTab = 'request' | 'response' | 'preview'
export type Channel = 'list' | 'detail' | 'pane' | 'fns' | 'apiPrefixes'

export const state = {
  records: [] as RequestRecord[],
  filter: '',
  filterMode: 'all' as FilterMode,
  selectedId: null as string | null,
  activeTab: 'request' as DetailTab,
  /** 业务判断函数集合（最多 5 条，仅一条 enabled） */
  successFns: [] as SuccessFnItem[],
  apiPrefixes: [] as string[],
  /**
   * 已经渲染过"闪烁动画"的记录 id 集合。
   * 闪烁是 CSS 动画 (iteration-count: N)；列表 re-render 会重建 <tr>，
   * 若每次都加 .blink 类动画就会重启，因此用集合记录"动画已经播过"的 id。
   */
  blinkedIds: new Set<string>(),
}

const listeners: Record<Channel, Set<() => void>> = {
  list: new Set(),
  detail: new Set(),
  pane: new Set(),
  fns: new Set(),
  apiPrefixes: new Set(),
}

export function on(channel: Channel, fn: () => void): () => void {
  listeners[channel].add(fn)
  return () => listeners[channel].delete(fn)
}

export function emit(channel: Channel): void {
  listeners[channel].forEach((fn) => fn())
}

// ---------- actions ----------

export function setFilter(value: string): void {
  state.filter = value
  emit('list')
}

export function setFilterMode(mode: FilterMode): void {
  state.filterMode = mode
  emit('list')
}

export function setSelectedId(id: string | null): void {
  state.selectedId = id
  emit('list')
  emit('detail')
}

export function setActiveTab(tab: DetailTab): void {
  state.activeTab = tab
  emit('pane')
}

export function setApiPrefixes(prefixes: string[]): void {
  state.apiPrefixes = prefixes
  emit('apiPrefixes')
}

export function setSuccessFns(items: SuccessFnItem[]): void {
  state.successFns = items
  emit('fns')
}

/** 当前启用的判断函数源码；无启用项返回空串（等价于关闭判断）。 */
export function getActiveSuccessFnSource(): string {
  const active = state.successFns.find((f) => f.enabled)
  return active ? active.code : ''
}

export function addRecord(record: RequestRecord): void {
  state.records.push(record)
  emit('list')
}

export function clearAll(): void {
  state.records = []
  state.selectedId = null
  state.blinkedIds.clear()
  emit('list')
  emit('detail')
}

export function markAllRead(): void {
  for (const r of state.records) r.viewed = true
  state.blinkedIds.clear()
  emit('list')
}

export function findRecord(id: string | null): RequestRecord | null {
  if (!id) return null
  return state.records.find((r) => r.id === id) ?? null
}
