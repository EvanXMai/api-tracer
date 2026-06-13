/**
 * Sandbox 页面（manifest.sandbox.pages 声明），运行在独立 origin，
 * 默认 CSP 允许 unsafe-eval / new Function，专用于编译/执行用户自定义 JS。
 *
 * 协议：
 *   收: { kind: 'api-tracer-sandbox-req', id, op: 'compile' | 'eval', payload }
 *   回: { kind: 'api-tracer-sandbox-res', id, result, error }
 *
 * 安全：用户输入是不受信任的代码。沙箱 iframe 自身的 origin 与扩展不同，
 * 但仍能调用 alert/confirm/prompt 等弹窗、操作 DOM、location 跳转等行为。
 * 因此在 new Function 包装时，把一长串危险全局用同名形参遮蔽为 undefined，
 * 让用户代码访问到的不是真正的全局对象，而是 undefined（取属性即 TypeError）。
 */

interface ReqMessage {
  kind: "api-tracer-sandbox-req";
  id: number;
  op: "compile" | "eval";
  payload: unknown;
}

// 通过形参遮蔽危险全局（"use strict" + 形参作用域 → 用户代码里的同名标识符
// 全部解析到 undefined，不再到达真正的 global）。
// 覆盖：BOM/DOM/弹窗/导航/网络/存储/定时器/扩展 API/eval 系。
const BLOCKED = [
  // 全局对象
  "window",
  "self",
  "globalThis",
  "top",
  "parent",
  "frames",
  "frameElement",
  "document",
  "documentElement",
  // 弹窗 / 打印
  "alert",
  "confirm",
  "prompt",
  "print",
  // 导航 / 历史 / 位置
  "location",
  "history",
  "navigator",
  "screen",
  // 窗口控制
  "open",
  "close",
  "focus",
  "blur",
  "moveBy",
  "moveTo",
  "resizeBy",
  "resizeTo",
  "scrollTo",
  "scrollBy",
  "scroll",
  "stop",
  // 事件
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
  "postMessage",
  "onload",
  "onunload",
  "onclick",
  "onerror",
  "onmessage",
  // 定时器 / 调度
  "setTimeout",
  "setInterval",
  "setImmediate",
  "clearTimeout",
  "clearInterval",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  // 网络
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "Worker",
  "SharedWorker",
  "ServiceWorker",
  "sendBeacon",
  "Notification",
  // 存储
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches",
  "cookieStore",
  // 加密 / 媒体
  "crypto",
  "subtle",
  "MediaDevices",
  "getUserMedia",
  // 扩展 API
  "chrome",
  "browser",
  // 元素 / 节点构造器（防止用户构造再注入 DOM）
  "Image",
  "Audio",
  "Video",
  "HTMLElement",
  "Element",
  "Node",
  "Document",
  // 动态求值（注：strict mode 下 eval/arguments 不能作为形参名，
  // 这里只能把可作为形参的 Function 加入屏蔽，eval/import 通过下面的静态扫描拦截）
  "Function",
];

/** 静态拒绝：strict mode 下不能用形参遮蔽的危险标识符 / 语法。 */
const STATIC_DENY: Array<{ re: RegExp; msg: string }> = [
  { re: /\beval\s*\(/, msg: "禁止使用 eval()" },
  { re: /\bnew\s+Function\b/, msg: "禁止使用 new Function" },
  { re: /\bimport\s*\(/, msg: "禁止使用动态 import()" },
  { re: /\barguments\b/, msg: "禁止访问 arguments" },
];

window.addEventListener("message", (e: MessageEvent) => {
  const data = e.data as ReqMessage | undefined;
  if (!data || data.kind !== "api-tracer-sandbox-req") return;

  let result: unknown = null;
  let error: string | null = null;

  try {
    if (data.op === "compile") {
      const src = String(data.payload ?? "").trim();
      if (src) compileFn(src);
    } else if (data.op === "eval") {
      const { source, data: arg } = data.payload as {
        source: string;
        data: unknown;
      };
      const src = String(source ?? "").trim();
      if (!src) {
        result = null;
      } else {
        const fn = compileFn(src);
        result = fn(arg);
      }
    }
  } catch (err) {
    error = (err as Error).message ?? String(err);
  }

  const reply = { kind: "api-tracer-sandbox-res", id: data.id, result, error };
  (e.source as Window | null)?.postMessage(reply, {
    targetOrigin: e.origin || "*",
  });
});

function compileFn(src: string): (res: unknown) => boolean {
  // 静态扫描：忽略字符串/注释中的命中，只对真实代码做匹配。
  const stripped = stripStringsAndComments(src);
  for (const { re, msg } of STATIC_DENY) {
    if (re.test(stripped)) throw new Error(msg);
  }

  // 兼容 "res => res.x" / "function(res){...}" / "res.x === 0" 三种写法
  // 用 BLOCKED 形参遮蔽危险全局；res 仍然是用户代码里的入参。
  const params = [...BLOCKED, "res"];
  const body = `"use strict"; const __fn=(${src}); return typeof __fn==='function'?!!__fn(res):!!__fn;`;
  const raw = new Function(...params, body) as (...args: unknown[]) => boolean;

  // 真正调用时把 BLOCKED 全部传 undefined，res 透传。
  const fn = (res: unknown): boolean => {
    const args = new Array(BLOCKED.length).fill(undefined);
    args.push(res);
    return raw.apply(undefined, args);
  };

  // 形态判定：是否为函数形式（箭头函数 / function 声明）
  const isFunctionForm =
    /^\s*(function\b|\(?\s*[a-zA-Z_$][\w$]*\s*\)?\s*=>)/.test(src);

  // 裸表达式必须以 `res.` 或 `res[` 开头：
  if (!isFunctionForm && !/^\s*res\s*[.[]/.test(src)) {
    throw new Error("裸表达式需要用 `res.xxx` 形式引用属性");
  }

  // 通用 ReferenceError 兜底：函数形式里若引用了未定义全局（如 res => a.x）
  // 也能在保存阶段被发现，避免之后所有请求都默默返回 null。
  // 用 Proxy 让任意属性访问/调用都安全，不污染 ReferenceError 检测。
  try {
    const probe: unknown = new Proxy(
      function () {
        /* noop */
      },
      {
        get: () => probe,
        apply: () => probe,
        has: () => true,
      },
    );
    fn(probe);
  } catch (err) {
    if (err instanceof ReferenceError) {
      const m = /(\w+) is not defined/.exec((err as Error).message ?? "");
      throw new Error(
        m
          ? `变量 "${m[1]}" 未定义，请检查代码`
          : "存在未定义的变量，请检查代码",
      );
    }
    if (err instanceof TypeError) {
      const msg = (err as Error).message ?? "";
      // 用户代码访问被遮蔽的全局（变成 undefined），取属性会抛 TypeError
      const m =
        /Cannot read propert(?:y|ies) of undefined .*?'(\w+)'/.exec(msg) ||
        /undefined .*?reading '(\w+)'/.exec(msg) ||
        /(\w+) is not a function/.exec(msg);
      if (m) {
        throw new Error(
          `代码包含被禁止的浏览器 API 调用（涉及 "${m[1]}"），仅允许基于 res 做纯计算。`,
        );
      }
      // 其他 TypeError 不在编译阶段拦截
    }
    // 其他错误属于运行期问题，不在编译阶段拦截
  }

  return fn;
}

// 通知父窗口已就绪
window.parent?.postMessage({ kind: "api-tracer-sandbox-ready" }, "*");

/** 把源码里的字符串/模板/注释替换成等长空格，避免静态扫描误判。 */
function stripStringsAndComments(src: string): string {
  const len = src.length;
  let out = "";
  let i = 0;
  while (i < len) {
    const c = src[i]!;
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      const e = end === -1 ? len : end;
      out += " ".repeat(e - i);
      i = e;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const e = end === -1 ? len : end + 2;
      out += " ".repeat(e - i);
      i = e;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < len) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === c) {
          j++;
          break;
        }
        j++;
      }
      out += " ".repeat(j - i);
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
