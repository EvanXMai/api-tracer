/**
 * Background service worker：在 content script 与 devtools panel 之间转发消息。
 *
 * - panel 在打开时通过 chrome.runtime.connect 建立长连接 port，
 *   首条消息携带 inspectedWindow.tabId（PanelHello）。
 * - content script 通过 chrome.runtime.sendMessage 发送 ForwardedPageMessage，
 *   sender.tab.id 用于路由到对应 panel port。
 */

import type { ForwardedPageMessage, PanelHello, RuntimeMessage } from '../shared/protocol'

/** tabId -> panel port */
const panelPorts = new Map<number, chrome.runtime.Port>()

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'api-tracer-panel') return

  let registeredTabId: number | null = null

  port.onMessage.addListener((msg: PanelHello) => {
    if (msg && msg.kind === 'panel-hello' && typeof msg.tabId === 'number') {
      registeredTabId = msg.tabId
      panelPorts.set(msg.tabId, port)
    }
  })

  port.onDisconnect.addListener(() => {
    if (registeredTabId !== null && panelPorts.get(registeredTabId) === port) {
      panelPorts.delete(registeredTabId)
    }
  })
})

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, sender) => {
  if (!msg || (msg as ForwardedPageMessage).kind !== 'page-message') return
  const tabId = sender.tab?.id
  if (typeof tabId !== 'number') return

  const port = panelPorts.get(tabId)
  if (!port) return

  const forwarded: ForwardedPageMessage = {
    ...(msg as ForwardedPageMessage),
    tabId,
  }
  try {
    port.postMessage(forwarded)
  } catch {
    // panel 已关闭，移除映射
    panelPorts.delete(tabId)
  }
})
