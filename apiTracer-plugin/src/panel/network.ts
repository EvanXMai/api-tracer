/**
 * 将 chrome.devtools.network 捕获到的 HAR entry 转换为内部 RequestRecord。
 */

import { HEADER_REQUEST_NAME, type RequestRecord } from '../shared/protocol'

let seq = 0
function nextId(): string {
  seq += 1
  return `req-${Date.now().toString(36)}-${seq}`
}

function headersToObject(
  headers: { name: string; value: string }[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  for (const h of headers) {
    out[h.name] = h.value
  }
  return out
}

/** 不区分大小写地查找请求头 */
function findHeader(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const target = name.toLowerCase()
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === target) return headers[k]
  }
  return undefined
}

/**
 * 异步获取响应体，返回填充好的 RequestRecord。
 * 调用方拿到后再补上 bizOk 字段。
 */
export function harEntryToRecord(
  entry: chrome.devtools.network.Request,
): Promise<RequestRecord | null> {
  return new Promise((resolve) => {
    try {
      const reqHeaders = headersToObject(entry.request.headers)
      const rawName = findHeader(reqHeaders, HEADER_REQUEST_NAME)
      const name = rawName ? safeDecode(rawName) : ''

      const respHeaders = headersToObject(entry.response.headers)
      const mime = entry.response.content?.mimeType ?? ''

      entry.getContent((content) => {
        const bodySize = entry.response.bodySize > 0
          ? entry.response.bodySize
          : entry.response.content?.size ?? (content?.length ?? 0)
        const record: RequestRecord = {
          id: nextId(),
          // 没有 X-Request-Name 头说明该请求不在用户配置的 API 前缀内，
          // 此时列表的「接口名称」列固定显示 `--`
          name: name || '--',
          method: entry.request.method,
          url: entry.request.url,
          status: entry.response.status,
          bizOk: null,
          time: Math.max(0, Math.round(entry.time ?? 0)),
          size: Math.max(0, bodySize),
          startedAt: Date.parse(entry.startedDateTime) || Date.now(),
          viewed: false,
          request: {
            headers: reqHeaders,
            queryString: entry.request.queryString,
            postData: entry.request.postData
              ? {
                  mimeType: entry.request.postData.mimeType,
                  text: entry.request.postData.text,
                }
              : undefined,
            httpVersion: entry.request.httpVersion,
          },
          response: {
            headers: respHeaders,
            body: content ?? '',
            mimeType: mime,
            httpVersion: entry.response.httpVersion,
          },
        }
        resolve(record)
      })
    } catch {
      resolve(null)
    }
  })
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * 跳过的请求类型：插件自身、扩展协议、data:、ws 等。
 * 也跳过明显的静态资源（按 mime 粗略过滤）。
 */
export function shouldKeep(entry: chrome.devtools.network.Request): boolean {
  const url = entry.request.url
  if (!/^https?:/i.test(url)) return false
  const mime = entry.response.content?.mimeType ?? ''
  // 仅保留 XHR/fetch 类（API）：通过 mime 粗判，html/css/js/image 不收
  if (/^(text\/html|text\/css|application\/javascript|image\/|font\/)/i.test(mime)) {
    return false
  }
  return true
}
