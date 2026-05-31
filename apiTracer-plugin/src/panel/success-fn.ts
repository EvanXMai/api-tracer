/**
 * 业务成功判断：所有动态执行均委托给 sandbox iframe。
 */

import { sandboxCompile, sandboxEval } from './sandbox-client'

/**
 * 校验源码是否能编译。空源码视为合法（关闭判断）。
 */
export async function compileSuccessFn(source: string): Promise<{ error: string | null }> {
  const r = await sandboxCompile(source)
  return { error: r.error }
}

/**
 * 在响应体上执行判断函数。
 * 返回 null 表示：未配置 / 无法判断 / 响应体非 JSON。
 *
 * 参数 `res` 直接就是解析后的响应体，与开发者在 DevTools Preview 中看到的一致。
 *   响应体 {"success": true} → res.success
 *   响应体 {"data": {"code": 0}} → res.data.code
 */
export async function evalSuccess(
  source: string,
  body: string,
  mimeType: string,
): Promise<boolean | null> {
  if (!source.trim()) return null
  if (!body) return null
  if (!/json/i.test(mimeType) && !/^[\s{[]/.test(body)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  return sandboxEval(source, parsed)
}
