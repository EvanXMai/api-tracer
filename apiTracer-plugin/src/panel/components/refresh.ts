/**
 * 顶部刷新按钮：刷新当前 inspectedWindow 页面，并清空已捕获请求列表。
 *
 * 在 DevTools 面板里 location.reload() 仅刷新 panel 自身（DevTools iframe），
 * 真正想做的是刷新被检视的页面 → 用 chrome.devtools.inspectedWindow.reload。
 */

import { clearAll } from '../store'

export function mountRefresh(): void {
  const btn = document.getElementById('refresh') as HTMLButtonElement | null
  if (!btn) return
  btn.addEventListener('click', () => {
    clearAll()
    try {
      chrome.devtools.inspectedWindow.reload({})
    } catch {
      // 非 devtools 环境兜底
      location.reload()
    }
  })
}
