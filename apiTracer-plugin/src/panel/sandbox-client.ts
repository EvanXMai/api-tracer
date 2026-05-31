/**
 * 与 sandbox iframe 的 RPC 客户端。
 * 用于编译/执行用户自定义的 JS（绕开 MV3 主页面 CSP unsafe-eval 限制）。
 */

let iframe: HTMLIFrameElement | null = null
let readyPromise: Promise<void> | null = null
let seq = 0
const pending = new Map<
  number,
  (res: { result: unknown; error: string | null }) => void
>()

function ensureIframe(): Promise<void> {
  if (readyPromise) return readyPromise
  readyPromise = new Promise<void>((resolve) => {
    const onReady = (e: MessageEvent) => {
      if ((e.data as { kind?: string } | undefined)?.kind === 'api-tracer-sandbox-ready') {
        window.removeEventListener('message', onReady)
        resolve()
      }
    }
    window.addEventListener('message', onReady)

    iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = chrome.runtime.getURL('sandbox/sandbox.html')
    document.body.appendChild(iframe)
  })

  // 全局消息监听：分发响应
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as
      | { kind: string; id: number; result: unknown; error: string | null }
      | undefined
    if (!d || d.kind !== 'api-tracer-sandbox-res') return
    const cb = pending.get(d.id)
    if (cb) {
      pending.delete(d.id)
      cb({ result: d.result, error: d.error })
    }
  })

  return readyPromise
}

async function call(
  op: 'compile' | 'eval',
  payload: unknown,
): Promise<{ result: unknown; error: string | null }> {
  await ensureIframe()
  const id = ++seq
  return new Promise((resolve) => {
    pending.set(id, resolve)
    iframe!.contentWindow!.postMessage(
      { kind: 'api-tracer-sandbox-req', id, op, payload },
      '*',
    )
  })
}

export async function sandboxCompile(source: string): Promise<{ ok: boolean; error: string | null }> {
  if (!source.trim()) return { ok: true, error: null }
  const r = await call('compile', source)
  return { ok: !r.error, error: r.error }
}

export async function sandboxEval(source: string, data: unknown): Promise<boolean | null> {
  if (!source.trim()) return null
  const r = await call('eval', { source, data })
  if (r.error) return null
  return typeof r.result === 'boolean' ? r.result : null
}
