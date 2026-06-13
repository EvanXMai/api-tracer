/**
 * 简易 JS 语法高亮：覆盖关键字 / 字面量 / 字符串 / 数字 / 注释 / 运算符
 * / 括号 / 标识符 / 属性 / 函数调用。
 * 输出 HTML 字符串，与 textarea 叠层渲染。
 */

const KEYWORDS = new Set([
  // 声明 / 控制流
  "function",
  "return",
  "if",
  "else",
  "var",
  "let",
  "const",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  // 运算符性关键字
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  // 类 / 模块
  "class",
  "extends",
  "super",
  "this",
  "import",
  "export",
  "from",
  "as",
  // 异步
  "await",
  "async",
  "yield",
  // 其他
  "with",
  "debugger",
  "static",
  "get",
  "set",
]);
const LITERALS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
]);
const BUILTINS = new Set([
  "console",
  "window",
  "document",
  "globalThis",
  "Math",
  "JSON",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "Symbol",
  "Promise",
  "Date",
  "RegExp",
  "Error",
  "Map",
  "Set",
  "Reflect",
  "Proxy",
]);

const OPS3 = ["===", "!==", "...", "**=", ">>>", "<<=", ">>="];
const OPS2 = [
  "==",
  "!=",
  ">=",
  "<=",
  "=>",
  "&&",
  "||",
  "??",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "**",
  ">>",
  "<<",
];
const OP_CHARS = "=<>!&|?:+-*/%~^";
const BRACKETS = "()[]{}";

interface Token {
  cls: string;
  text: string;
}

export function highlightJs(code: string): string {
  const tokens: Token[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    const c = code[i]!;
    const next = code[i + 1];

    // 行注释
    if (c === "/" && next === "/") {
      const end = code.indexOf("\n", i);
      const e = end === -1 ? len : end;
      tokens.push({ cls: "comment", text: code.slice(i, e) });
      i = e;
      continue;
    }
    // 块注释
    if (c === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const e = end === -1 ? len : end + 2;
      tokens.push({ cls: "comment", text: code.slice(i, e) });
      i = e;
      continue;
    }
    // 字符串
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < len) {
        if (code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code[j] === c) {
          j++;
          break;
        }
        j++;
      }
      tokens.push({ cls: "string", text: code.slice(i, j) });
      i = j;
      continue;
    }
    // 数字
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < len && /[0-9._eE+\-xXa-fA-F]/.test(code[j]!)) j++;
      tokens.push({ cls: "number", text: code.slice(i, j) });
      i = j;
      continue;
    }
    // 标识符 / 关键字
    if (/[a-zA-Z_$]/.test(c)) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_$]/.test(code[j]!)) j++;
      const word = code.slice(i, j);
      let cls: string;
      if (KEYWORDS.has(word)) cls = "keyword";
      else if (LITERALS.has(word)) cls = "literal";
      else if (BUILTINS.has(word)) cls = "builtin";
      else {
        // 上一个有效（非空白）token 是 "."？→ 属性访问
        const prev = lastMeaningful(tokens);
        if (prev && prev.cls === "punct" && prev.text === ".") {
          cls = "property";
        } else {
          // 向后看：跳过空白后是否紧跟 "("？→ 函数调用
          let k = j;
          while (k < len && /\s/.test(code[k]!)) k++;
          cls = code[k] === "(" ? "fn" : "ident";
        }
      }
      tokens.push({ cls, text: word });
      i = j;
      continue;
    }
    // 括号 / 大括号 / 方括号
    if (BRACKETS.includes(c)) {
      tokens.push({ cls: "bracket", text: c });
      i++;
      continue;
    }
    // 多字符运算符
    if (i + 2 < len && OPS3.includes(code.slice(i, i + 3))) {
      tokens.push({ cls: "operator", text: code.slice(i, i + 3) });
      i += 3;
      continue;
    }
    if (i + 1 < len && OPS2.includes(code.slice(i, i + 2))) {
      tokens.push({ cls: "operator", text: code.slice(i, i + 2) });
      i += 2;
      continue;
    }
    // 单字符运算符
    if (OP_CHARS.includes(c)) {
      tokens.push({ cls: "operator", text: c });
      i++;
      continue;
    }
    // 标点（. , ; :）
    if (c === "." || c === "," || c === ";" || c === ":") {
      tokens.push({ cls: "punct", text: c });
      i++;
      continue;
    }
    // 其他（空白等）
    tokens.push({ cls: "plain", text: c });
    i++;
  }

  return tokens
    .map((t) =>
      t.cls === "plain"
        ? escapeHtml(t.text)
        : `<span class="tok-${t.cls}">${escapeHtml(t.text)}</span>`,
    )
    .join("");
}

function lastMeaningful(tokens: Token[]): Token | null {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]!;
    if (t.cls === "plain" && /^\s+$/.test(t.text)) continue;
    return t;
  }
  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
