/**
 * API 前缀匹配。npm 包通过 postMessage 下发项目自己的 API 前缀，
 * 插件仅对匹配前缀的请求运行业务成功判断函数。
 *
 * 支持两种形式：
 *  - 绝对前缀：`https://api.example.com[/...]`，与 URL 整体做 startsWith
 *  - 路径前缀：`/api`、`/api/v2`，与 URL.pathname 做 startsWith
 */

export function urlMatchesPrefix(url: string, prefixes: string[]): boolean {
  if (!prefixes || prefixes.length === 0) return false
  for (const raw of prefixes) {
    if (!raw) continue
    const p = raw.trim()
    if (!p) continue
    if (/^https?:\/\//i.test(p)) {
      if (url.startsWith(p)) return true
    } else {
      try {
        const u = new URL(url)
        const pathPrefix = p.startsWith('/') ? p : '/' + p
        if (u.pathname.startsWith(pathPrefix)) return true
      } catch {
        // 非法 URL，跳过
      }
    }
  }
  return false
}
