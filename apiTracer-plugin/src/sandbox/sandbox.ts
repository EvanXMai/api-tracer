/**
 * Sandbox 页面（manifest.sandbox.pages 声明），运行在独立 origin，
 * 默认 CSP 允许 unsafe-eval / new Function，专用于编译/执行用户自定义 JS。
 *
 * 协议：
 *   收: { kind: 'api-tracer-sandbox-req', id, op: 'compile' | 'eval', payload }
 *   回: { kind: 'api-tracer-sandbox-res', id, result, error }
 */

interface ReqMessage {
  kind: 'api-tracer-sandbox-req'
  id: number
  op: 'compile' | 'eval'
  payload: unknown
}

window.addEventListener('message', (e: MessageEvent) => {
  const data = e.data as ReqMessage | undefined
  if (!data || data.kind !== 'api-tracer-sandbox-req') return

  let result: unknown = null
  let error: string | null = null

  try {
    if (data.op === 'compile') {
      const src = String(data.payload ?? '').trim()
      if (src) compileFn(src)
    } else if (data.op === 'eval') {
      const { source, data: arg } = data.payload as { source: string; data: unknown }
      const src = String(source ?? '').trim()
      if (!src) {
        result = null
      } else {
        const fn = compileFn(src)
        result = fn(arg)
      }
    }
  } catch (err) {
    error = (err as Error).message ?? String(err)
  }

  const reply = { kind: 'api-tracer-sandbox-res', id: data.id, result, error }
  ;(e.source as Window | null)?.postMessage(reply, { targetOrigin: e.origin || '*' })
})

function compileFn(src: string): (res: unknown) => boolean {
  // 兼容 "res => res.x" / "function(res){...}" / "res.x === 0" 三种写法
  const fn = new Function(
    'res',
    `"use strict"; const __fn=(${src}); return typeof __fn==='function'?!!__fn(res):!!__fn;`,
  ) as (res: unknown) => boolean

  // 形态判定：是否为函数形式（箭头函数 / function 声明）
  const isFunctionForm = /^\s*(function\b|\(?\s*[a-zA-Z_$][\w$]*\s*\)?\s*=>)/.test(src)

  // 裸表达式必须以 `res.` 或 `res[` 开头：
  //   - 排除 `1.1 === 1` / `true` 这类不引用响应体的废表达式
  //   - 排除 `"res" === "res"` 这类字符串字面量混淆
  //   - 排除 `a.success === true` 这类用错变量名（也会被下面 ReferenceError 兜底）
  if (!isFunctionForm && !/^\s*res\s*[.[]/.test(src)) {
    throw new Error('裸表达式需要用 `res.xxx` 形式引用属性')
  }

  // 通用 ReferenceError 兜底：函数形式里若引用了未定义全局（如 res => a.x）
  // 也能在保存阶段被发现，避免之后所有请求都默默返回 null。
  // 用 Proxy 让任意属性访问/调用都安全，不污染 ReferenceError 检测。
  try {
    const probe: unknown = new Proxy(
      function () {
        /* noop */
      },
      {
        get: () => probe,
        apply: () => probe,
        has: () => true,
      },
    )
    fn(probe)
  } catch (err) {
    if (err instanceof ReferenceError) {
      const m = /(\w+) is not defined/.exec((err as Error).message ?? '')
      throw new Error(
        m ? `变量 "${m[1]}" 未定义，请检查代码` : '存在未定义的变量，请检查代码',
      )
    }
    // 其他错误（TypeError 等）属于运行期问题，不在编译阶段拦截
  }

  return fn
}

// 通知父窗口已就绪
window.parent?.postMessage({ kind: 'api-tracer-sandbox-ready' }, '*')
