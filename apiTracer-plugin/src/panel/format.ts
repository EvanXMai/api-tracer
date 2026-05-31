/**
 * 纯展示用的格式化 / HTML 拼接工具。
 * 所有函数无副作用、不依赖 DOM 与 store。
 */

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

export function urlPath(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search + u.hash
  } catch {
    return url
  }
}

export function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

export function formatHeaders(h: Record<string, string>): string {
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

export function tryFormatJson(s: string): string {
  if (!s) return ''
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

/**
 * 将 HAR 里的 httpVersion 与 URL scheme 合并为友好显示。
 * - httpVersion 只表示协议版本（1.0/1.1/2.0/3.0），不包含是否 TLS
 * - 是否 HTTPS 由 URL 的 scheme 决定
 */
export function formatHttpVersion(v: string | undefined, url: string): string {
  if (!v) return '—'
  const s = v.trim()
  if (!s) return '—'
  const lower = s.toLowerCase()
  const isHttps = /^https:/i.test(url)
  const scheme = isHttps ? 'HTTPS' : 'HTTP'
  if (lower === 'h2' || lower === 'http/2' || lower === 'http/2.0') return `${scheme}/2.0`
  if (lower === 'h3' || lower === 'http/3' || lower === 'http/3.0') return `${scheme}/3.0`
  if (/^http\/1\.0$/i.test(s)) return `${scheme}/1.0`
  if (/^http\/1\.1$/i.test(s)) return `${scheme}/1.1`
  return '—'
}

export function methodPill(method: string): string {
  const m = (method || 'GET').toUpperCase()
  const known = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  const cls = known.includes(m) ? `pill-method-${m}` : 'pill-method-default'
  return `<span class="pill ${cls}">${escapeHtml(m)}</span>`
}

export function statusPill(status: number): string {
  if (!status) return `<span class="pill pill-status-x">—</span>`
  const tier = Math.floor(status / 100)
  const cls =
    tier === 2 ? 'pill-status-2' :
    tier === 3 ? 'pill-status-3' :
    tier === 4 ? 'pill-status-4' :
    tier === 5 ? 'pill-status-5' :
    'pill-status-x'
  return `<span class="pill ${cls}">${status}</span>`
}

export function bizCell(bizOk: boolean | null): string {
  if (bizOk === true) return `<span class="pill pill-biz-ok">✓</span>`
  if (bizOk === false) return `<span class="pill pill-biz-fail">✗</span>`
  return `<span class="biz-empty">--</span>`
}

/** 详情区折叠区块（带 meta 计数） */
export function section(title: string, meta: number, inner: string): string {
  const metaText = meta > 0 ? `${meta}` : ''
  return `
    <details class="section" open>
      <summary>
        <span>${escapeHtml(title)}</span>
        ${metaText ? `<span class="section-meta">${metaText}</span>` : ''}
      </summary>
      <div class="section-body">${inner}</div>
    </details>
  `
}

export function kv(rows: [string, string][]): string {
  if (rows.length === 0) return '<div class="codeblock empty">(空)</div>'
  return (
    '<div class="kv">' +
    rows
      .map(([k, v]) => `<div class="k">${escapeHtml(k)}</div><div class="v">${v}</div>`)
      .join('') +
    '</div>'
  )
}

export function codeblock(text: string): string {
  if (!text) return '<div class="codeblock empty">(空)</div>'
  return `<pre class="codeblock">${escapeHtml(text)}</pre>`
}
