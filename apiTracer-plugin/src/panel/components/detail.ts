/**
 * 详情区编排：
 * - 监听 selectedId / activeTab 变化
 * - 切换 detail 容器与 splitter 显隐
 * - 调度 Request / Response / Preview 三个子面板
 */

import { findRecord, on, setSelectedId, state } from "../store";
import { mountTabs } from "./tabs";
import { renderPreviewPane } from "./pane-preview";
import { renderRequestPane } from "./pane-request";
import { renderResponsePane } from "./pane-response";
import { relayoutForDetailHidden, relayoutForDetailVisible } from "./splitter";

/** 获取 section-body 的纯文本内容用于复制 */
function getSectionText(sectionEl: HTMLDetailsElement): string {
  const body = sectionEl.querySelector(".section-body");
  if (!body) return "";
  // codeblock / pre → textContent 即原始文本
  const pre = body.querySelector("pre.codeblock");
  if (pre) return pre.textContent ?? "";
  // kv 网格 → 拼成 key: value 行
  const keys = Array.from(body.querySelectorAll(".k"));
  const vals = Array.from(body.querySelectorAll(".v"));
  if (keys.length > 0) {
    return keys
      .map((k, i) => `${k.textContent}: ${vals[i]?.textContent ?? ""}`)
      .join("\n");
  }
  return body.textContent ?? "";
}

function bindCopyButtons(host: HTMLElement): void {
  host.addEventListener("click", (e) => {
    const btn = (e.target as Element).closest(
      ".section-copy-btn",
    ) as HTMLButtonElement | null;
    if (!btn) return;
    e.stopPropagation(); // 防止触发 details toggle
    const section = btn.closest(".section") as HTMLDetailsElement | null;
    if (!section) return;
    const text = getSectionText(section);
    navigator.clipboard.writeText(text).then(() => {
      const icon = btn.querySelector(".icon");
      btn.classList.add("copied");
      icon?.classList.replace("icon-copy", "icon-check");
      const tid = Number(btn.dataset.copyTimer);
      if (tid) clearTimeout(tid);
      btn.dataset.copyTimer = String(
        setTimeout(() => {
          btn.classList.remove("copied");
          icon?.classList.replace("icon-check", "icon-copy");
          delete btn.dataset.copyTimer;
        }, 1500),
      );
    });
  });
}

export function mountDetail(): void {
  const detail = document.getElementById("detail-pane") as HTMLElement;
  const splitter = document.getElementById("splitter") as HTMLElement;
  const close = document.getElementById("detail-close") as HTMLButtonElement;
  const paneRequest = document.getElementById("pane-request") as HTMLElement;
  const paneResponse = document.getElementById("pane-response") as HTMLElement;
  const panePreview = document.getElementById("pane-preview") as HTMLElement;

  mountTabs();

  close.addEventListener("click", () => setSelectedId(null));

  // 在三个 pane 上各绑一次，事件委托处理复制
  bindCopyButtons(paneRequest);
  bindCopyButtons(paneResponse);
  bindCopyButtons(panePreview);

  const renderActivePane = (): void => {
    const r = findRecord(state.selectedId);
    if (!r) return;
    if (state.activeTab === "request") renderRequestPane(paneRequest, r);
    else if (state.activeTab === "response")
      renderResponsePane(paneResponse, r);
    else renderPreviewPane(panePreview, r);
  };

  const renderDetail = (): void => {
    const r = findRecord(state.selectedId);
    if (!r) {
      detail.classList.add("hidden");
      splitter.classList.add("hidden");
      relayoutForDetailHidden();
      return;
    }
    detail.classList.remove("hidden");
    splitter.classList.remove("hidden");
    relayoutForDetailVisible();
    renderActivePane();
  };

  on("detail", renderDetail);
  on("pane", renderActivePane);
  renderDetail();
}
