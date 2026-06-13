/**
 * Request 面板：URL / Method / Headers / Query / Body。
 */

import type { RequestRecord } from "../../shared/protocol";
import {
  codeblock,
  escapeHtml,
  formatHeaders,
  formatHttpVersion,
  kv,
  section,
  tryFormatJson,
  urlPath,
} from "../format";

export function renderRequestPane(host: HTMLElement, r: RequestRecord): void {
  const headers = formatHeaders(r.request.headers);
  const headersCount = Object.keys(r.request.headers).length;

  const queryStr = (r.request.queryString ?? [])
    .map((q) => `${q.name}=${q.value}`)
    .join("\n");
  const bodyText = r.request.postData?.text ?? "";

  host.innerHTML = `
    ${section(
      "概要",
      1,
      kv([
        ["方法", escapeHtml(r.method)],
        ["URL", escapeHtml(r.url)],
        ["路径", escapeHtml(urlPath(r.url))],
        ["函数名", escapeHtml(r.name)],
        ["协议", escapeHtml(formatHttpVersion(r.request.httpVersion, r.url))],
      ]),
    )}
    ${section("Query 参数", r.request.queryString?.length ?? 0, codeblock(queryStr))}
    ${section("请求头", headersCount, codeblock(headers))}
    ${section("请求体", bodyText ? 1 : 0, codeblock(tryFormatJson(bodyText)))}
  `;
}
