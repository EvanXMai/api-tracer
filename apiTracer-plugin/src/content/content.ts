/**
 * Content script：在页面 ISOLATED world 中运行，监听 window.postMessage，
 * 转发给 background service worker。
 */

import {
  POST_MESSAGE_SOURCE,
  type PageMessage,
  type ForwardedPageMessage,
} from '../shared/protocol'

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const data = event.data as PageMessage | undefined
  if (!data || typeof data !== 'object') return
  if (data.source !== POST_MESSAGE_SOURCE) return

  const forwarded: ForwardedPageMessage = {
    kind: 'page-message',
    // tabId 由 background 通过 sender.tab 补充，这里占位 0
    tabId: 0,
    message: data,
  }
  try {
    chrome.runtime.sendMessage(forwarded)
  } catch {
    // background 未就绪或扩展上下文失效，忽略
  }
})
