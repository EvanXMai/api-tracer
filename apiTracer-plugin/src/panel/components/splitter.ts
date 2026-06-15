/**
 * 详情区与列表区之间的可拖拽分隔条。
 *
 * 实现策略：用 **flex-grow 比例** 而非绝对宽度。
 * - .list 与 .detail 都是 `flex: 1 1 0; min-width: 0`
 * - 拖动 splitter 时，根据鼠标位置计算 detail 想要的宽度，
 *   再换算成 detail/list 的 flex-grow 比例并写入 style
 * - 容器宽度变化时，浏览器自动按比例分配两侧宽度，
 *   不需要 JS 再 clamp、也不会出现"最小总宽撑不下导致右边界被挡"
 *
 * detail 隐藏（无选中行）时，调用 `relayoutForDetailHidden()` 把 list 的
 * flex-grow 显式置 1，避免任何潜在的 0-比例残留导致右侧出现空白。
 */

// detail 与 list 各自最小占比（避免完全收缩为 0 看不见）
const MIN_RATIO = 0.15;
// 默认 detail 占比；打开详情时左右面板 = 1 : 3（detail : list = 3 : 1）
const DEFAULT_DETAIL_RATIO = 3 / 4;

// 用模块级变量记录最近一次 detail 占比，用于隐藏 → 再次显示时恢复
let lastDetailRatio = DEFAULT_DETAIL_RATIO;

const listEl = (): HTMLElement =>
  document.getElementById("list-pane") as HTMLElement;
const detailElx = (): HTMLElement =>
  document.getElementById("detail-pane") as HTMLElement;

function applyRatio(detailGrow: number): void {
  const d = Math.max(MIN_RATIO, Math.min(1 - MIN_RATIO, detailGrow));
  lastDetailRatio = d;
  listEl().style.flexGrow = String(1 - d);
  detailElx().style.flexGrow = String(d);
}

/** detail 隐藏时调用：让 list 占满整个 body，避免右侧空白 */
export function relayoutForDetailHidden(): void {
  listEl().style.flexGrow = "1";
  detailElx().style.flexGrow = "0";
}

/** detail 重新显示时调用：恢复上次的占比 */
export function relayoutForDetailVisible(): void {
  applyRatio(lastDetailRatio);
}

export function mountSplitter(): void {
  const splitter = document.getElementById("splitter") as HTMLElement;
  const detail = detailElx();
  const body = document.getElementById("body") as HTMLElement;

  // 初始按 detail 是否隐藏决定布局
  if (detail.classList.contains("hidden")) {
    relayoutForDetailHidden();
  } else {
    applyRatio(DEFAULT_DETAIL_RATIO);
  }

  let dragging = false;
  let bodyRect = { left: 0, right: 0, width: 0 };

  const onMove = (e: MouseEvent): void => {
    if (!dragging || bodyRect.width <= 0) return;
    const desiredDetailWidth = bodyRect.right - e.clientX;
    const ratio = desiredDetailWidth / bodyRect.width;
    applyRatio(ratio);
  };

  const onUp = (): void => {
    dragging = false;
    splitter.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  splitter.addEventListener("mousedown", (e) => {
    if (detail.classList.contains("hidden")) return;
    dragging = true;
    const rect = body.getBoundingClientRect();
    bodyRect = { left: rect.left, right: rect.right, width: rect.width };
    splitter.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}
