/**
 * 业务成功判断求值器：决定单条记录的 bizOk，并在前缀/判断函数变化时批量重新评估。
 */

import type { RequestRecord } from '../shared/protocol'
import { urlMatchesPrefix } from './api-prefix'
import { state, emit, getActiveSuccessFnSource } from './store'
import { evalSuccess } from './success-fn'

export async function evalForRecord(r: RequestRecord): Promise<boolean | null> {
  // 不在用户配置的前缀范围内：保持业务结果为 null（列表显示 `--`）
  if (!urlMatchesPrefix(r.url, state.apiPrefixes)) return null
  return evalSuccess(getActiveSuccessFnSource(), r.response.body, r.response.mimeType)
}

export async function reevaluateAll(): Promise<void> {
  await Promise.all(
    state.records.map(async (r) => {
      r.bizOk = await evalForRecord(r)
    }),
  )
  emit('list')
}
