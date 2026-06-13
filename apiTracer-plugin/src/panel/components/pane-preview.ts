/**
 * Preview 面板：JSON 走 jsonTree 树形展示，否则按纯文本。
 */

import type { RequestRecord } from "../../shared/protocol";
import { escapeHtml } from "../format";
import { renderJsonTree } from "../json-tree";

export function renderPreviewPane(host: HTMLElement, r: RequestRecord): void {
  host.innerHTML = "";
  const wrapper = document.createElement("details");
  wrapper.className = "section";
  wrapper.open = true;

  const summary = document.createElement("summary");
  summary.innerHTML = `<span>预览</span>`;

  // 右侧容器：数字 + 复制按钮
  const right = document.createElement("span");
  right.className = "section-right";

  const meta = document.createElement("span");
  meta.className = "section-meta";
  meta.textContent = escapeHtml(r.response.mimeType || "unknown");
  right.appendChild(meta);

  // 复制按钮
  const copyBtn = document.createElement("button");
  copyBtn.className = "section-copy-btn";
  copyBtn.title = "复制";
  copyBtn.innerHTML = `<span class="icon icon-copy"></span>`;
  copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(r.response.body ?? "").then(() => {
      const icon = copyBtn.querySelector(".icon");
      copyBtn.classList.add("copied");
      icon?.classList.replace("icon-copy", "icon-check");
      const tid = Number(copyBtn.dataset.copyTimer);
      if (tid) clearTimeout(tid);
      copyBtn.dataset.copyTimer = String(
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          icon?.classList.replace("icon-check", "icon-copy");
          delete copyBtn.dataset.copyTimer;
        }, 1500),
      );
    });
  });
  right.appendChild(copyBtn);
  summary.appendChild(right);

  wrapper.appendChild(summary);

  const body = document.createElement("div");
  body.className = "section-body";
  wrapper.appendChild(body);
  host.appendChild(wrapper);

  const raw = r.response.body;
  if (!raw) {
    body.innerHTML = '<div class="codeblock empty">(无响应体)</div>';
    return;
  }

  let parsed: unknown;
  let isJson = false;
  if (/json/i.test(r.response.mimeType) || /^[\s{[]/.test(raw)) {
    try {
      parsed = JSON.parse(raw);
      isJson = true;
    } catch {
      isJson = false;
    }
  }

  if (isJson) {
    const treeWrap = document.createElement("div");
    treeWrap.className = "json-tree";
    body.appendChild(treeWrap);
    renderJsonTree(parsed, treeWrap);
  } else {
    const pre = document.createElement("pre");
    pre.className = "codeblock";
    pre.textContent = raw;
    body.appendChild(pre);
  }
}
