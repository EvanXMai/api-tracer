/**
 * 与页面侧 api-tracer-ast 包的桥接：
 * - 通过 background port 接收页面下发的 config 消息（apiPrefixes）
 * - 监听 chrome.devtools.network 收集请求并交给求值器
 */

import type { ForwardedPageMessage, PanelHello } from '../shared/protocol'
import { harEntryToRecord, shouldKeep } from './network'
import { evalForRecord, reevaluateAll } from './evaluator'
import { addRecord, clearAll, setApiPrefixes } from './store'

export function startNetworkBridge(): void {
  const tabId = chrome.devtools.inspectedWindow.tabId
  const port = chrome.runtime.connect({ name: 'api-tracer-panel' })
  const hello: PanelHello = { kind: 'panel-hello', tabId }
  port.postMessage(hello)

  port.onMessage.addListener((msg: ForwardedPageMessage) => {
    if (!msg || msg.kind !== 'page-message') return
    if (msg.tabId !== tabId) return
    const m = msg.message
    if (m.type === 'config') {
      const next = Array.isArray(m.payload.apiPrefixes) ? m.payload.apiPrefixes : []
      setApiPrefixes(next)
      // 前缀变化后，重新评估已有记录
      void reevaluateAll()
    }
  })

  chrome.devtools.network.onRequestFinished.addListener(async (entry) => {
    if (!shouldKeep(entry)) return
    const record = await harEntryToRecord(entry)
    if (!record) return
    record.bizOk = await evalForRecord(record)
    addRecord(record)
  })

  chrome.devtools.network.onNavigated.addListener(() => {
    // 页面整体导航（地址栏 URL 变化）时清空，避免不同页面请求混淆。
    // SPA 内部路由切换不会触发该事件，列表会持续累积；用户可通过"清空"按钮手动重置。
    clearAll()
  })
}
