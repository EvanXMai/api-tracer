/**
 * 插件内多端通信协议（page <-> content <-> background <-> devtools panel）。
 */

/** 与 api-tracer-ast 约定的 source 标记 */
export const POST_MESSAGE_SOURCE = 'api-tracer'

export const HEADER_REQUEST_NAME = 'X-Request-Name'

/** 页面通过 window.postMessage 发出的消息 */
export interface PageMessage {
  source: typeof POST_MESSAGE_SOURCE
  type: 'config'
  payload: { apiPrefixes: string[] }
}

/** content -> background -> panel 转发的消息（含 tabId） */
export interface ForwardedPageMessage {
  kind: 'page-message'
  tabId: number
  message: PageMessage
}

/** panel -> background：注册关注的 tabId（建立长连接 port 时携带） */
export interface PanelHello {
  kind: 'panel-hello'
  tabId: number
}

export type RuntimeMessage = ForwardedPageMessage | PanelHello

/** panel 内部使用的请求模型 */
export interface RequestRecord {
  id: string
  /** 业务函数名；未匹配到 API 前缀（即未注入 X-Request-Name 头）时为 `'--'` */
  name: string
  method: string
  url: string
  status: number
  /** 业务成功判断结果：true=成功，false=失败，null=未配置或不在前缀范围内 */
  bizOk: boolean | null
  /** 耗时(ms) */
  time: number
  /** 响应体大小（字节，HAR bodySize） */
  size: number
  /** 起始时间戳 */
  startedAt: number
  /** 用户是否已查看过该记录（点击展开过详情）。新到达的请求 viewed=false，
   *  在列表里以高亮 + 黄点 + 闪烁 3s 提示，点击后置为 true 并恢复常态。 */
  viewed: boolean
  request: {
    headers: Record<string, string>
    queryString?: { name: string; value: string }[]
    postData?: { mimeType?: string; text?: string }
    /** 协议版本，例如 "HTTP/1.1" / "h2" / "h3" */
    httpVersion?: string
  }
  response: {
    headers: Record<string, string>
    body: string
    mimeType: string
    /** 协议版本，例如 "HTTP/1.1" / "h2" / "h3" */
    httpVersion?: string
  }
}
