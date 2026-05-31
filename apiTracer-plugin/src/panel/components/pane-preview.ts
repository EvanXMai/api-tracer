/**
 * Preview 面板：JSON 走 jsonTree 树形展示，否则按纯文本。
 */

import type { RequestRecord } from '../../shared/protocol'
import { escapeHtml } from '../format'
import { renderJsonTree } from '../json-tree'

export function renderPreviewPane(host: HTMLElement, r: RequestRecord): void {
  host.innerHTML = ''
  const wrapper = document.createElement('details')
  wrapper.className = 'section'
  wrapper.open = true

  const summary = document.createElement('summary')
  summary.innerHTML = `<span>预览</span><span class="section-meta">${escapeHtml(r.response.mimeType || 'unknown')}</span>`
  wrapper.appendChild(summary)

  const body = document.createElement('div')
  body.className = 'section-body'
  wrapper.appendChild(body)
  host.appendChild(wrapper)

  const raw = r.response.body
  if (!raw) {
    body.innerHTML = '<div class="codeblock empty">(无响应体)</div>'
    return
  }

  let parsed: unknown
  let isJson = false
  if (/json/i.test(r.response.mimeType) || /^[\s{[]/.test(raw)) {
    try {
      parsed = JSON.parse(raw)
      isJson = true
    } catch {
      isJson = false
    }
  }

  if (isJson) {
    const treeWrap = document.createElement('div')
    treeWrap.className = 'json-tree'
    body.appendChild(treeWrap)
    renderJsonTree(parsed, treeWrap)
  } else {
    const pre = document.createElement('pre')
    pre.className = 'codeblock'
    pre.textContent = raw
    body.appendChild(pre)
  }
}
