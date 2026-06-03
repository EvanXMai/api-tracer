/**
 * 请求列表（左侧主区）：根据 store + 筛选模式渲染表格。
 * 点击行 → 选中并打开详情；列表订阅 'list' 通道事件自动刷新。
 */

import type { RequestRecord } from "../../shared/protocol";
import { urlMatchesPrefix } from "../api-prefix";
import {
  bizCell,
  escapeHtml,
  methodPill,
  statusPill,
  urlPath,
} from "../format";
import { on, setSelectedId, state } from "../store";

const DEFAULT_GROUP_WIDTHS = { name: 30, meta: 30, url: 40 };
const MIN_GROUP_WIDTH = 14;
let groupWidths = { ...DEFAULT_GROUP_WIDTHS };
let resizing = false;

function passesFilterMode(r: RequestRecord): boolean {
  switch (state.filterMode) {
    case "success":
      return r.bizOk === true;
    case "fail":
      return r.bizOk === false;
    case "prefix":
      return urlMatchesPrefix(r.url, state.apiPrefixes);
    case "named":
      return !!r.name && r.name !== "--";
    case "all":
    default:
      return true;
  }
}

function visibleRecords(): RequestRecord[] {
  const f = state.filter;
  let list = state.records.filter(passesFilterMode);
  if (f) {
    list = list.filter(
      (r) =>
        r.name.toLowerCase().includes(f) || r.url.toLowerCase().includes(f),
    );
  }
  // 时间升序：早到达在顶部，新到达在底部
  list.sort((a, b) => a.startedAt - b.startedAt);
  return list;
}

export function mountRequestList(): void {
  const table = document.getElementById("req-table") as HTMLTableElement;
  const scroll = table.closest(".list-scroll") as HTMLElement;
  const tbody = document.getElementById("req-tbody") as HTMLTableSectionElement;
  const empty = document.getElementById("empty") as HTMLElement;

  const applyLayout = (): void => {
    table.classList.toggle("detail-open", state.hasDetail);
    if (state.hasDetail) {
      table.style.setProperty("--col-name", "100%");
      table.style.setProperty("--col-meta", "0%");
      table.style.setProperty("--col-url", "0%");
      table.style.setProperty("--col-method", "0%");
      table.style.setProperty("--col-biz", "0%");
      table.style.setProperty("--col-status", "0%");
      return;
    }
    table.style.setProperty("--col-name", `${groupWidths.name}%`);
    table.style.setProperty("--col-meta", `${groupWidths.meta}%`);
    table.style.setProperty("--col-url", `${groupWidths.url}%`);
    table.style.setProperty("--col-method", `${groupWidths.meta / 3}%`);
    table.style.setProperty("--col-biz", `${groupWidths.meta / 3}%`);
    table.style.setProperty("--col-status", `${groupWidths.meta / 3}%`);
  };

  const render = (): void => {
    const list = visibleRecords();
    empty.classList.toggle("hidden", list.length > 0);
    tbody.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const r of list) {
      const tr = document.createElement("tr");
      tr.dataset.id = r.id;
      if (r.id === state.selectedId) tr.classList.add("selected");

      // 接口名称的高亮逻辑：未点击过 (!viewed) 才显示黄色 + 黄点；首次渲染附加 .blink。
      const isFresh = !r.viewed;
      const shouldBlink = isFresh && !state.blinkedIds.has(r.id);
      if (shouldBlink) state.blinkedIds.add(r.id);
      const nameClass =
        "col-name" + (isFresh ? " fresh" : "") + (shouldBlink ? " blink" : "");

      tr.innerHTML = `
        <td class="${nameClass}">${escapeHtml(r.name)}</td>
        <td class="col-method">${methodPill(r.method)}</td>
        <td class="col-biz">${bizCell(r.bizOk)}</td>
        <td class="col-status">${statusPill(r.status)}</td>
        <td class="col-url">${escapeHtml(urlPath(r.url))}</td>
      `;
      tr.addEventListener("click", () => {
        if (resizing) return;
        r.viewed = true;
        state.blinkedIds.delete(r.id);
        setSelectedId(r.id);
      });
      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
    applyLayout();
  };

  mountColumnResizers(table, scroll, applyLayout);
  on("list", render);
  on("layout", applyLayout);
  render();
}

function mountColumnResizers(
  table: HTMLTableElement,
  scroll: HTMLElement,
  applyLayout: () => void,
): void {
  const nameHandle = table.querySelector(
    '[data-resize="name"]',
  ) as HTMLElement | null;
  const urlHandle = table.querySelector(
    '[data-resize="url"]',
  ) as HTMLElement | null;

  nameHandle?.addEventListener("mousedown", (event) =>
    startResize(event, "name", table, applyLayout),
  );
  urlHandle?.addEventListener("mousedown", (event) =>
    startResize(event, "url", table, applyLayout),
  );
  scroll.addEventListener("mousemove", (event) =>
    updateResizeHover(event, table, scroll),
  );
  scroll.addEventListener(
    "mouseleave",
    () => (scroll.dataset.resizeHover = ""),
  );
  scroll.addEventListener("mousedown", (event) => {
    const type = getResizeTypeAt(event, table, scroll);
    if (!type) return;
    startResize(event, type, table, applyLayout);
  });
}

function updateResizeHover(
  event: MouseEvent,
  table: HTMLTableElement,
  scroll: HTMLElement,
): void {
  scroll.dataset.resizeHover = getResizeTypeAt(event, table, scroll) || "";
}

function getResizeTypeAt(
  event: MouseEvent,
  table: HTMLTableElement,
  scroll: HTMLElement,
): "name" | "url" | null {
  if (state.hasDetail) return null;
  const rect = table.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const scrollRect = scroll.getBoundingClientRect();
  if (event.clientY < scrollRect.top || event.clientY > scrollRect.bottom)
    return null;
  const x = event.clientX - rect.left;
  const nameBoundary = rect.width * (groupWidths.name / 100);
  const urlBoundary =
    rect.width * ((groupWidths.name + groupWidths.meta) / 100);
  if (Math.abs(x - nameBoundary) <= 4) return "name";
  if (Math.abs(x - urlBoundary) <= 4) return "url";
  return null;
}

function startResize(
  event: MouseEvent,
  type: "name" | "url",
  table: HTMLTableElement,
  applyLayout: () => void,
): void {
  if (state.hasDetail) return;
  const rect = table.getBoundingClientRect();
  if (rect.width <= 0) return;
  const startX = event.clientX;
  const startWidths = { ...groupWidths };

  const onMove = (moveEvent: MouseEvent): void => {
    const delta = ((moveEvent.clientX - startX) / rect.width) * 100;
    groupWidths =
      type === "name"
        ? resizeBoundary(startWidths, "name", delta)
        : resizeBoundary(startWidths, "url", delta);
    applyLayout();
  };

  const onUp = (): void => {
    window.setTimeout(() => (resizing = false), 0);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  resizing = true;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  event.preventDefault();
  event.stopPropagation();
}

function resizeBoundary(
  base: typeof DEFAULT_GROUP_WIDTHS,
  boundary: "name" | "url",
  delta: number,
): typeof DEFAULT_GROUP_WIDTHS {
  if (boundary === "name") {
    const pair = base.name + base.meta;
    const name = clamp(
      base.name + delta,
      MIN_GROUP_WIDTH,
      pair - MIN_GROUP_WIDTH,
    );
    return { name, meta: pair - name, url: base.url };
  }
  const pair = base.meta + base.url;
  const meta = clamp(
    base.meta + delta,
    MIN_GROUP_WIDTH,
    pair - MIN_GROUP_WIDTH,
  );
  return { name: base.name, meta, url: pair - meta };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
