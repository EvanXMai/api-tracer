/**
 * 用 chrome.storage.local 持久化用户配置。
 *
 * 数据结构：业务成功判断函数集合（最多 5 条，仅 1 条 enabled）。
 * 兼容旧版本：若仅存在旧 key 'api-tracer.successFn'（string），启动时迁移为
 * 单条命名为「默认」的启用函数。
 */

export interface SuccessFnItem {
  /** 唯一 id（前端生成，仅本地使用） */
  id: string
  /** 函数名，不可重复 */
  name: string
  /** 函数源码（支持箭头函数 / 裸表达式） */
  code: string
  /** 是否启用；同一时刻仅一条为 true */
  enabled: boolean
}

const KEY_FNS = 'api-tracer.successFns'
const KEY_LEGACY = 'api-tracer.successFn'

export const MAX_SUCCESS_FNS = 5

export function genFnId(): string {
  return 'fn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
}

function isItem(v: unknown): v is SuccessFnItem {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.code === 'string' &&
    typeof o.enabled === 'boolean'
  )
}

export async function loadSuccessFns(): Promise<SuccessFnItem[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([KEY_FNS, KEY_LEGACY], (res) => {
        const newer = res?.[KEY_FNS]
        if (Array.isArray(newer)) {
          resolve(newer.filter(isItem).slice(0, MAX_SUCCESS_FNS))
          return
        }
        // 迁移旧数据：单条 string → 单条 enabled 的函数
        const legacy = res?.[KEY_LEGACY] as string | undefined
        if (typeof legacy === 'string' && legacy.trim()) {
          resolve([{ id: genFnId(), name: '默认', code: legacy, enabled: true }])
          return
        }
        resolve([])
      })
    } catch {
      resolve([])
    }
  })
}

export async function saveSuccessFns(items: SuccessFnItem[]): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ [KEY_FNS]: items }, () => resolve())
    } catch {
      resolve()
    }
  })
}
