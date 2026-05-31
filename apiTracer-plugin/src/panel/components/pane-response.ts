/**
 * Response 面板：状态 / Headers / Body。
 */

import type { RequestRecord } from '../../shared/protocol'
import {
  codeblock,
  escapeHtml,
  formatHeaders,
  formatHttpVersion,
  formatSize,
  kv,
  section,
  tryFormatJson,
} from '../format'

export function renderResponsePane(host: HTMLElement, r: RequestRecord): void {
  const headers = formatHeaders(r.response.headers)
  const headersCount = Object.keys(r.response.headers).length
  const bizText =
    r.bizOk === true ? '业务成功'
      : r.bizOk === false ? '业务失败'
        : '未配置 / 无法判断'

  host.innerHTML = `
    ${section('状态', 1,
      kv([
        ['HTTP', `${r.status} (${bizText})`],
        ['协议', escapeHtml(formatHttpVersion(r.response.httpVersion, r.url))],
        ['Mime', escapeHtml(r.response.mimeType || '—')],
        ['大小', formatSize(r.size)],
        ['耗时', r.time + 'ms'],
      ])
    )}
    ${section('响应头', headersCount, codeblock(headers))}
    ${section(
      '响应体',
      r.response.body ? 1 : 0,
      codeblock(tryFormatJson(r.response.body)),
    )}
  `
}
