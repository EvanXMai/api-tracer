/**
 * 通用确认弹窗。返回 Promise<boolean>，true=确认，false=取消/关闭。
 *
 * 复用 #confirm-dialog 元素，可与 settings-dialog 嵌套（HTML5 spec 支持多 dialog 共存于 top layer）。
 */

let dialog: HTMLDialogElement | null = null
let messageEl: HTMLElement | null = null
let okBtn: HTMLButtonElement | null = null
let cancelBtn: HTMLButtonElement | null = null
let closeBtn: HTMLButtonElement | null = null
let resolver: ((v: boolean) => void) | null = null

function init(): void {
  if (dialog) return
  dialog = document.getElementById('confirm-dialog') as HTMLDialogElement
  messageEl = document.getElementById('confirm-message')
  okBtn = document.getElementById('confirm-ok') as HTMLButtonElement
  cancelBtn = document.getElementById('confirm-cancel') as HTMLButtonElement
  closeBtn = document.getElementById('confirm-close') as HTMLButtonElement

  okBtn?.addEventListener('click', () => settle(true))
  cancelBtn?.addEventListener('click', () => settle(false))
  closeBtn?.addEventListener('click', () => settle(false))
  // Esc / 点击外层 backdrop 关闭时也算取消
  dialog?.addEventListener('close', () => {
    if (resolver) settle(false)
  })
}

function settle(v: boolean): void {
  const r = resolver
  resolver = null
  if (dialog?.open) dialog.close()
  if (r) r(v)
}

export function confirm(message: string): Promise<boolean> {
  init()
  if (!dialog || !messageEl) return Promise.resolve(false)
  messageEl.textContent = message
  return new Promise((resolve) => {
    resolver = resolve
    dialog!.showModal()
    // 默认聚焦"取消"，避免误删
    setTimeout(() => cancelBtn?.focus(), 0)
  })
}
