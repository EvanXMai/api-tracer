/**
 * 列表表头"接口名称"右侧的未读请求徽标。
 *
 * 行为：
 *  - 计数 = 未点击查看过的请求数（viewed=false）
 *  - 0 时整个 badge hidden（不显示数字也不显示 "0"）
 *  - 大于 99 显示 "99+"
 *  - 当列表新增请求（records.length 增加）且当前未读 > 0 时：
 *    给表头容器（.col-name）加上 .has-unread.blink，文字变黄并闪烁 5s
 *  - 用户点击行 / 点"已读" / "清空" 后，未读归 0 → 表头恢复原样
 */

import { on, state } from '../store'

const BLINK_MS = 5000

let badge: HTMLElement | null = null
let header: HTMLElement | null = null
let lastTotal = 0
let blinkTimer: number | null = null

export function mountUnreadBadge(): void {
  badge = document.getElementById('unread-badge')
  header = badge?.closest('th.col-name') as HTMLElement | null
  if (!badge) return
  on('list', render)
  lastTotal = state.records.length
  render(true) // 初次渲染不触发动画
}

function unreadCount(): number {
  let n = 0
  for (const r of state.records) if (!r.viewed) n++
  return n
}

function render(skipBlink = false): void {
  if (!badge) return
  const unread = unreadCount()
  const total = state.records.length
  const arrived = total > lastTotal
  lastTotal = total

  if (unread <= 0) {
    badge.classList.add('hidden')
    badge.textContent = ''
    header?.classList.remove('has-unread', 'blink')
    stopBlink()
    return
  }

  badge.classList.remove('hidden')
  badge.textContent = unread > 99 ? '99+' : String(unread)
  header?.classList.add('has-unread')

  if (arrived && !skipBlink) startBlink()
}

function startBlink(): void {
  if (!header) return
  // 重启动画：先去掉再下一帧加上，确保每次都重新跑 5s
  header.classList.remove('blink')
  void header.offsetWidth
  header.classList.add('blink')
  if (blinkTimer != null) clearTimeout(blinkTimer)
  blinkTimer = window.setTimeout(() => {
    header?.classList.remove('blink')
    blinkTimer = null
  }, BLINK_MS)
}

function stopBlink(): void {
  if (!header) return
  header.classList.remove('blink')
  if (blinkTimer != null) {
    clearTimeout(blinkTimer)
    blinkTimer = null
  }
}
