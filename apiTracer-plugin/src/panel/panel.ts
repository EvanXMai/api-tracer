/**
 * ApiTracer 面板主入口（bootstrap）。
 *
 * 职责：装配各个组件 + 启动网络桥 + 加载持久化配置。
 * 业务逻辑全部下沉到 ./store.ts（状态/事件）、./components/*（视图）。
 */

import { mountDetail } from './components/detail'
import { mountRefresh } from './components/refresh'
import { mountRequestList } from './components/request-list'
import { mountSettingsDialog } from './components/settings-dialog'
import { mountSplitter } from './components/splitter'
import { mountTopbar } from './components/topbar'
import { mountUnreadBadge } from './components/unread-badge'
import { reevaluateAll } from './evaluator'
import { startNetworkBridge } from './network-bridge'
import { loadSuccessFns } from './storage'
import { setSuccessFns } from './store'

;(async () => {
  // 顺序：dialog 先于 topbar（topbar 的"配置"按钮会调用 openSettingsDialog）
  mountSettingsDialog()
  mountTopbar()
  mountRefresh()
  mountUnreadBadge()
  mountRequestList()
  mountDetail()
  mountSplitter()

  // 网络监听：放在视图挂载之后，避免初次事件先于订阅到达
  startNetworkBridge()

  // 持久化配置加载：业务成功判断函数集合
  const fns = await loadSuccessFns()
  setSuccessFns(fns)
  await reevaluateAll()
})()
