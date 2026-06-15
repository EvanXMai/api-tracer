/**
 * Request 面板：URL / Method / Headers / Query / Body。
 */

import type { RequestRecord } from "../../shared/protocol";
import {
  codeblock,
  escapeHtml,
  formatHttpVersion,
  kv,
  section,
  tryFormatJson,
  urlPath,
} from "../format";

export function renderRequestPane(host: HTMLElement, r: RequestRecord): void {
  const headerRows: [string, string][] = Object.entries(r.request.headers).map(
    ([k, v]) => [k, escapeHtml(v)],
  );
  const headersCount = headerRows.length;

  const queryRows: [string, string][] = (r.request.queryString ?? []).map(
    (q) => [q.name, escapeHtml(q.value)],
  );
  const queryCount = queryRows.length;

  const bodyText = r.request.postData?.text ?? "";

  host.innerHTML = `
    ${section(
      "概要",
      1,
      kv(
        [
          ["方法", escapeHtml(r.method)],
          ["URL", escapeHtml(r.url)],
          ["路径", escapeHtml(urlPath(r.url))],
          ["函数名", escapeHtml(r.name)],
          ["协议", escapeHtml(formatHttpVersion(r.request.httpVersion, r.url))],
        ],
        "wide",
      ),
    )}
    ${section("Query 参数", queryCount, queryCount > 0 ? kv(queryRows) : codeblock(""))}
    ${section("请求头", headersCount, headersCount > 0 ? kv(headerRows) : codeblock(""))}
    ${section("请求体", bodyText ? 1 : 0, codeblock(tryFormatJson(bodyText)))}
  `;
}
