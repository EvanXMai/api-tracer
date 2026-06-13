/**
 * 业务成功判断函数配置弹窗（多函数版）：
 *  - 顶部：已存函数列表（启用 radio / 编辑 / 删除 / 批量删除）
 *  - 下方：新增 / 编辑表单（名称 + 代码 + 格式化 + 提交）
 *  - 持久化：chrome.storage.local 'api-tracer.successFns'
 *  - 启用切换 / 编辑 / 增删 → 立即重新评估所有已存请求
 */

import { CodeEditor } from "../code-editor";
import { reevaluateAll } from "../evaluator";
import { formatJs } from "../js-format";
import {
  MAX_SUCCESS_FNS,
  SuccessFnItem,
  genFnId,
  saveSuccessFns,
} from "../storage";
import { on, setSuccessFns, state } from "../store";
import { compileSuccessFn } from "../success-fn";
import { escapeHtml } from "../format";
import { confirm } from "./confirm";

let editor: CodeEditor | null = null;
let dialog: HTMLDialogElement | null = null;
let errorEl: HTMLElement | null = null;
let apiPrefixDisplayEl: HTMLElement | null = null;

// ----- 表单与列表内部 UI 状态 -----
let editingId: string | null = null;
let batchMode = false;

// ----- 元素引用 -----
let listEl: HTMLUListElement;
let countEl: HTMLElement;
let nameInput: HTMLInputElement;
let submitBtn: HTMLButtonElement;
let cancelEditBtn: HTMLButtonElement;
let batchToggleBtn: HTMLButtonElement;
let bulkDeleteBtn: HTMLButtonElement;

export function mountSettingsDialog(): void {
  dialog = document.getElementById("settings-dialog") as HTMLDialogElement;
  const formatBtn = document.getElementById(
    "settings-format",
  ) as HTMLButtonElement;
  const editorHost = document.getElementById("settings-editor") as HTMLElement;
  const closeBtn = document.getElementById(
    "settings-close",
  ) as HTMLButtonElement;
  errorEl = document.getElementById("settings-error") as HTMLElement;
  apiPrefixDisplayEl = document.getElementById(
    "api-prefix-display",
  ) as HTMLElement;
  listEl = document.getElementById("fn-list") as HTMLUListElement;
  countEl = document.getElementById("fn-count") as HTMLElement;
  nameInput = document.getElementById("fn-name") as HTMLInputElement;
  submitBtn = document.getElementById("fn-submit") as HTMLButtonElement;
  cancelEditBtn = document.getElementById(
    "fn-cancel-edit",
  ) as HTMLButtonElement;
  batchToggleBtn = document.getElementById(
    "fn-batch-toggle",
  ) as HTMLButtonElement;
  bulkDeleteBtn = document.getElementById(
    "fn-bulk-delete",
  ) as HTMLButtonElement;

  editor = new CodeEditor(editorHost);
  editor.setPlaceholder("res => res.success === true 或 res.success === true");
  renderApiPrefixes();
  on("apiPrefixes", renderApiPrefixes);

  closeBtn.addEventListener("click", () => dialog?.close());

  formatBtn.addEventListener("click", () => {
    if (!editor) return;
    const formatted = formatJs(editor.value);
    if (formatted !== editor.value) editor.value = formatted;
    clearError();
    syncSecondaryBtn();
  });

  submitBtn.addEventListener("click", () => void onSubmit());
  cancelEditBtn.addEventListener("click", () => onSecondaryClick());
  batchToggleBtn.addEventListener("click", () => toggleBatchMode());
  bulkDeleteBtn.addEventListener("click", () => void onBulkDelete());

  // 名称 / 代码输入变化 → 同步底部副按钮（清空 / 取消编辑 / 隐藏）
  nameInput.addEventListener("input", syncSecondaryBtn);
  editor.textarea.addEventListener("input", syncSecondaryBtn);

  // 列表事件委托：启用 radio / 编辑 / 删除 / 复选
  listEl.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const li = target.closest("li[data-id]") as HTMLElement | null;
    if (!li) return;
    const id = li.dataset.id!;
    if (target.closest(".fn-edit")) {
      enterEditMode(id);
    } else if (target.closest(".fn-delete")) {
      void onDelete(id);
    }
  });
  listEl.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    const li = target.closest("li[data-id]") as HTMLElement | null;
    if (!li) return;
    const id = li.dataset.id!;
    if (target.matches(".fn-radio")) {
      void onEnable(id);
    }
    // 复选框只影响 UI（批量删除按钮启用态），不需要立即 store 同步
    if (target.matches(".fn-checkbox")) updateBulkDeleteState();
  });
}

export function openSettingsDialog(): void {
  if (!dialog) return;
  exitEditMode();
  if (batchMode) toggleBatchMode();
  renderList();
  dialog.showModal();
  setTimeout(() => nameInput?.focus(), 0);
}

// ---------- 渲染 ----------

function renderApiPrefixes(): void {
  if (!apiPrefixDisplayEl) return;
  if (state.apiPrefixes.length === 0) {
    apiPrefixDisplayEl.textContent =
      "当前暂无配置api前缀，请在构建文件中配置。";
    return;
  }
  apiPrefixDisplayEl.textContent = `当前配置的api前缀：${state.apiPrefixes.join(", ")}`;
}

function renderList(): void {
  listEl.innerHTML = "";
  countEl.textContent = String(state.successFns.length);
  const frag = document.createDocumentFragment();
  for (const item of state.successFns) {
    const li = document.createElement("li");
    li.dataset.id = item.id;
    if (item.id === editingId) li.classList.add("editing");
    li.innerHTML = `
      <input type="checkbox" class="fn-checkbox" aria-label="选择" />
      <input type="radio" class="fn-radio" name="fn-enabled" ${item.enabled ? "checked" : ""} aria-label="启用" />
      <span class="fn-name" title="${escapeAttr(item.name)}">${escapeHtml(item.name)}</span>
      <span class="fn-code" title="${escapeAttr(item.code)}">${escapeHtml(item.code)}</span>
      <span class="fn-actions">
        <button type="button" class="fn-icon-btn fn-edit" title="编辑" aria-label="编辑">
          <span class="icon icon-edit" aria-hidden="true"></span>
        </button>
        <button type="button" class="fn-icon-btn fn-delete" title="删除" aria-label="删除">
          <span class="icon icon-trash" aria-hidden="true"></span>
        </button>
      </span>
    `;
    frag.appendChild(li);
  }
  listEl.appendChild(frag);
  listEl.classList.toggle("batch", batchMode);
  updateBulkDeleteState();
}

function escapeAttr(s: string): string {
  return s.replace(/[&"<>]/g, (c) =>
    c === "&" ? "&amp;" : c === '"' ? "&quot;" : c === "<" ? "&lt;" : "&gt;",
  );
}

// ---------- 表单交互 ----------

function enterEditMode(id: string): void {
  const item = state.successFns.find((f) => f.id === id);
  if (!item || !editor) return;
  editingId = id;
  nameInput.value = item.name;
  editor.value = item.code;
  submitBtn.textContent = "保存修改";
  syncSecondaryBtn();
  clearError();
  renderList();
  setTimeout(() => editor?.focus(), 0);
}

function exitEditMode(): void {
  editingId = null;
  if (editor) editor.value = "";
  nameInput.value = "";
  submitBtn.textContent = "新增";
  syncSecondaryBtn();
  clearError();
  renderList();
}

/** 副按钮文案 + 显隐：
 *  - 编辑模式 → "取消编辑"
 *  - 非编辑 + 表单有内容 → "清空"
 *  - 非编辑 + 表单空 → 隐藏
 */
function syncSecondaryBtn(): void {
  if (!cancelEditBtn || !nameInput || !editor) return;
  if (editingId) {
    cancelEditBtn.textContent = "取消编辑";
    cancelEditBtn.classList.remove("hidden");
    return;
  }
  const hasInput = nameInput.value.trim() !== "" || editor.value.trim() !== "";
  if (hasInput) {
    cancelEditBtn.textContent = "清空";
    cancelEditBtn.classList.remove("hidden");
  } else {
    cancelEditBtn.classList.add("hidden");
  }
}

/** 副按钮点击：编辑模式取消编辑；否则清空表单。 */
function onSecondaryClick(): void {
  if (editingId) {
    exitEditMode();
    return;
  }
  if (editor) editor.value = "";
  nameInput.value = "";
  clearError();
  syncSecondaryBtn();
}

async function onSubmit(): Promise<void> {
  if (!editor) return;
  const name = nameInput.value.trim();
  // 提交前自动格式化代码：保证保存进 storage 的形式与"格式化"按钮一致
  const rawCode = editor.value.trim();
  const code = rawCode ? formatJs(rawCode) : "";
  if (code !== editor.value) editor.value = code;
  if (!name) return setError("名称不能为空");
  if (!code) return setError("函数内容不能为空");

  // 名称唯一（编辑模式下排除自身）
  const dup = state.successFns.find(
    (f) => f.name === name && f.id !== editingId,
  );
  if (dup) return setError("名称已存在");

  // 数量上限（仅新增时校验）
  if (!editingId && state.successFns.length >= MAX_SUCCESS_FNS) {
    return setError(`最多只能保存 ${MAX_SUCCESS_FNS} 条`);
  }

  // 编译校验（含箭头函数 / 裸表达式 / function 形式）
  const { error } = await compileSuccessFn(code);
  if (error) return setError(error);

  let next: SuccessFnItem[];
  if (editingId) {
    next = state.successFns.map((f) =>
      f.id === editingId ? { ...f, name, code } : f,
    );
  } else {
    const isFirst = state.successFns.length === 0;
    next = [
      ...state.successFns,
      { id: genFnId(), name, code, enabled: isFirst },
    ];
  }
  await persist(next);
  exitEditMode();
}

async function onDelete(id: string): Promise<void> {
  const target = state.successFns.find((f) => f.id === id);
  if (!target) return;
  const ok = await confirm(`确定删除函数「${target.name}」吗？`);
  if (!ok) return;
  let next = state.successFns.filter((f) => f.id !== id);
  // 如果删除的是当前启用项，自动把第一条设为启用（若仍有）
  if (target.enabled && next.length > 0 && !next.some((f) => f.enabled)) {
    next = next.map((f, i) => ({ ...f, enabled: i === 0 }));
  }
  await persist(next);
  if (editingId === id) exitEditMode();
}

async function onBulkDelete(): Promise<void> {
  const checkboxes = listEl.querySelectorAll<HTMLInputElement>(
    ".fn-checkbox:checked",
  );
  if (checkboxes.length === 0) return;
  const ok = await confirm(`确定删除选中的 ${checkboxes.length} 条函数吗？`);
  if (!ok) return;
  const ids = new Set<string>();
  checkboxes.forEach((cb) => {
    const li = cb.closest("li[data-id]") as HTMLElement | null;
    if (li?.dataset.id) ids.add(li.dataset.id);
  });
  let next = state.successFns.filter((f) => !ids.has(f.id));
  if (next.length > 0 && !next.some((f) => f.enabled)) {
    next = next.map((f, i) => ({ ...f, enabled: i === 0 }));
  }
  await persist(next);
  if (editingId && ids.has(editingId)) exitEditMode();
  if (batchMode) toggleBatchMode();
}

async function onEnable(id: string): Promise<void> {
  const next = state.successFns.map((f) => ({ ...f, enabled: f.id === id }));
  await persist(next);
}

// ---------- 批量模式 ----------

function toggleBatchMode(): void {
  batchMode = !batchMode;
  batchToggleBtn.textContent = batchMode ? "退出批量" : "批量";
  bulkDeleteBtn.classList.toggle("hidden", !batchMode);
  listEl.classList.toggle("batch", batchMode);
  updateBulkDeleteState();
}

function updateBulkDeleteState(): void {
  if (!batchMode) return;
  const any =
    listEl.querySelectorAll<HTMLInputElement>(".fn-checkbox:checked").length >
    0;
  bulkDeleteBtn.disabled = !any;
}

// ---------- 共用 ----------

async function persist(next: SuccessFnItem[]): Promise<void> {
  setSuccessFns(next);
  await saveSuccessFns(next);
  await reevaluateAll();
  renderList();
}

function setError(msg: string): void {
  if (errorEl) errorEl.textContent = msg;
}
function clearError(): void {
  if (errorEl) errorEl.textContent = "";
}
