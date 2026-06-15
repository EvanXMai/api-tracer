/**
 * Response 面板：状态 / Headers / Body。
 */

import type { RequestRecord } from "../../shared/protocol";
import {
  codeblock,
  escapeHtml,
  formatHttpVersion,
  formatSize,
  kv,
  section,
  tryFormatJson,
} from "../format";
import { renderJsonTree } from "../json-tree";

export function renderResponsePane(host: HTMLElement, r: RequestRecord): void {
  const headerRows: [string, string][] = Object.entries(r.response.headers).map(
    ([k, v]) => [k, escapeHtml(v)],
  );
  const headersCount = headerRows.length;
  const bizText =
    r.bizOk === true
      ? "业务成功"
      : r.bizOk === false
        ? "业务失败"
        : "未配置 / 无法判断";

  // 响应体：JSON 走 jsonTree（flat 模式：纯高亮、无折叠、无虚线）；否则 codeblock 兜底
  const raw = r.response.body ?? "";
  let parsed: unknown;
  let isJson = false;
  if (raw && (/json/i.test(r.response.mimeType) || /^[\s{[]/.test(raw))) {
    try {
      parsed = JSON.parse(raw);
      isJson = true;
    } catch {
      isJson = false;
    }
  }
  const bodyHtml = isJson
    ? '<div class="json-tree flat" data-json-tree-flat="1"></div>'
    : codeblock(tryFormatJson(raw));

  host.innerHTML = `
    ${section(
      "状态",
      1,
      kv(
        [
          ["HTTP", `${r.status} (${bizText})`],
          [
            "协议",
            escapeHtml(formatHttpVersion(r.response.httpVersion, r.url)),
          ],
          ["Mime", escapeHtml(r.response.mimeType || "—")],
          ["大小", formatSize(r.size)],
          ["耗时", r.time + "ms"],
        ],
        "wide",
      ),
    )}
    ${section("响应头", headersCount, headersCount > 0 ? kv(headerRows) : codeblock(""))}
    ${section("响应体", raw ? 1 : 0, bodyHtml)}
  `;

  // JSON 树需要 DOM 挂载后再渲染
  if (isJson) {
    const treeEl = host.querySelector<HTMLElement>('[data-json-tree-flat="1"]');
    if (treeEl) renderJsonTree(parsed, treeEl, { flat: true });
  }
}
