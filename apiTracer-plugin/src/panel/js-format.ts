/**
 * JS 代码格式化器：基于轻量 token 流。
 *
 * 能力：
 *  - 字符串/注释/模板内部不动
 *  - 在合适位置自动补分号（用户输入换行但漏写 `;`）
 *  - "{" 后换行并增加缩进；"}" 前减缩进并独占一行
 *  - ";" 后换行（除 `for(...)` 头部）
 *  - 多个连续空白合并为单个空格
 *  - 运算符两侧补空格（=>、===、!==、&&、||、??、=、<、> …）
 *  - 宽松等于升级为严格等于：== → ===，!= → !==
 *  - "," 后强制补一个空格
 */

const INDENT = "  ";

interface Tok {
  type:
    | "ws"
    | "nl"
    | "lcomment"
    | "bcomment"
    | "string"
    | "number"
    | "ident"
    | "op"
    | "punct"
    | "lbrace"
    | "rbrace"
    | "lparen"
    | "rparen"
    | "lbracket"
    | "rbracket"
    | "semi";
  text: string;
}

const KEYWORDS_NO_ASI = new Set([
  // 后面紧跟表达式 / 块的关键字，不应在它们后面补分号
  "function",
  "return",
  "throw",
  "new",
  "typeof",
  "instanceof",
  "in",
  "of",
  "delete",
  "void",
  "await",
  "yield",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "try",
  "catch",
  "finally",
  "class",
  "extends",
  "import",
  "export",
  "from",
  "as",
  "this",
  "super",
  "var",
  "let",
  "const",
  "async",
]);

const OPS3 = ["===", "!==", "...", "**=", ">>>", "<<=", ">>="];
const OPS2 = [
  "===",
  "!==",
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

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const len = src.length;
  while (i < len) {
    const c = src[i]!;
    const next = src[i + 1];

    if (c === "\n") {
      out.push({ type: "nl", text: "\n" });
      i++;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      let j = i;
      while (j < len && (src[j] === " " || src[j] === "\t" || src[j] === "\r"))
        j++;
      out.push({ type: "ws", text: " " });
      i = j;
      continue;
    }
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      const e = end === -1 ? len : end;
      out.push({ type: "lcomment", text: src.slice(i, e) });
      i = e;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const e = end === -1 ? len : end + 2;
      out.push({ type: "bcomment", text: src.slice(i, e) });
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
      out.push({ type: "string", text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < len && /[0-9._eE+\-xXa-fA-F]/.test(src[j]!)) j++;
      out.push({ type: "number", text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_$]/.test(c)) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_$]/.test(src[j]!)) j++;
      out.push({ type: "ident", text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "{") {
      out.push({ type: "lbrace", text: "{" });
      i++;
      continue;
    }
    if (c === "}") {
      out.push({ type: "rbrace", text: "}" });
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ type: "lparen", text: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ type: "rparen", text: ")" });
      i++;
      continue;
    }
    if (c === "[") {
      out.push({ type: "lbracket", text: "[" });
      i++;
      continue;
    }
    if (c === "]") {
      out.push({ type: "rbracket", text: "]" });
      i++;
      continue;
    }
    if (c === ";") {
      out.push({ type: "semi", text: ";" });
      i++;
      continue;
    }
    if (c === "," || c === "." || c === ":") {
      out.push({ type: "punct", text: c });
      i++;
      continue;
    }
    // 多字符运算符
    if (i + 2 < len && OPS3.includes(src.slice(i, i + 3))) {
      out.push({ type: "op", text: src.slice(i, i + 3) });
      i += 3;
      continue;
    }
    if (i + 1 < len && OPS2.includes(src.slice(i, i + 2))) {
      let op = src.slice(i, i + 2);
      if (op === "==") op = "===";
      else if (op === "!=") op = "!==";
      out.push({ type: "op", text: op });
      i += 2;
      continue;
    }
    // 单字符运算符
    if ("=<>!&|?+-*/%~^".includes(c)) {
      out.push({ type: "op", text: c });
      i++;
      continue;
    }
    // 兜底
    out.push({ type: "punct", text: c });
    i++;
  }
  return out;
}

/** 上一个非空白/换行/注释 token */
function prevSig(toks: Tok[], idx: number): Tok | null {
  for (let i = idx - 1; i >= 0; i--) {
    const t = toks[i]!;
    if (
      t.type === "ws" ||
      t.type === "nl" ||
      t.type === "lcomment" ||
      t.type === "bcomment"
    )
      continue;
    return t;
  }
  return null;
}

/** 下一个非空白/换行/注释 token */
function nextSig(toks: Tok[], idx: number): Tok | null {
  for (let i = idx + 1; i < toks.length; i++) {
    const t = toks[i]!;
    if (
      t.type === "ws" ||
      t.type === "nl" ||
      t.type === "lcomment" ||
      t.type === "bcomment"
    )
      continue;
    return t;
  }
  return null;
}

/** 判断一个 token 是否能作为「语句结尾」出现在它之前一行末（即可以在它之后插 `;`） */
function canEndStmt(t: Tok): boolean {
  if (t.type === "ident") {
    // 关键字之后不能补分号
    if (KEYWORDS_NO_ASI.has(t.text)) return false;
    return true;
  }
  if (t.type === "string" || t.type === "number") return true;
  if (t.type === "rparen" || t.type === "rbracket") return true;
  // ++/-- 后置操作符之后可以
  if (t.type === "op" && (t.text === "++" || t.text === "--")) return true;
  return false;
}

/** 判断下一行起始 token 是否表明上一行可能是一句完整语句的结束（即下一行可以独立成句） */
function canStartStmt(t: Tok): boolean {
  if (t.type === "rbrace") return true; // 块结束 → 上一句应该有 `;`
  if (t.type === "ident") {
    // 几乎任何标识符或关键字都可以开启新语句
    return true;
  }
  if (t.type === "string" || t.type === "number") return true;
  if (t.type === "lbrace") return true;
  // `(` `[` `+` `-` 等容易让 ASI 失败，但在用户最终代码里我们仍然倾向补分号
  return false;
}

/** 在 token 流上做 ASI：换行处若上一句看起来已结束、且下一行能独立成句，则插入 `;`。 */
function insertSemicolons(toks: Tok[]): Tok[] {
  // 第一遍：标记每个 rparen 是否是控制流 (if/for/while/switch/catch) 的右括号。
  // 控制流 `)` 后接换行不能补分号，否则 `if(x);` 把控制流体当成空语句。
  const ctrlRparen = new Set<number>();
  {
    const stack: { isCtrl: boolean }[] = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i]!;
      if (t.type === "lparen") {
        const prev = prevSig(toks, i);
        const isCtrl =
          prev?.type === "ident" &&
          (prev.text === "if" ||
            prev.text === "for" ||
            prev.text === "while" ||
            prev.text === "switch" ||
            prev.text === "catch");
        stack.push({ isCtrl });
      } else if (t.type === "rparen") {
        const top = stack.pop();
        if (top?.isCtrl) ctrlRparen.add(i);
      }
    }
  }

  // 第二遍：跟踪 for( 头部，并在合适的换行处插入分号。
  const forStack: boolean[] = [];
  const result: Tok[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.type === "lparen") {
      const prev = prevSig(toks, i);
      forStack.push(prev?.type === "ident" && prev.text === "for");
    } else if (t.type === "rparen") {
      forStack.pop();
    }
    result.push(t);
    if (t.type !== "nl") continue;
    // 在 for(..) 内部不补分号
    if (forStack.length > 0 && forStack[forStack.length - 1]) continue;
    const prev = prevSig(toks, i);
    const nxt = nextSig(toks, i);
    if (!prev || !nxt) continue;
    if (
      prev.type === "semi" ||
      prev.type === "lbrace" ||
      prev.type === "rbrace" ||
      prev.type === "lparen" ||
      prev.type === "lbracket" ||
      prev.type === "punct" /* . , : */ ||
      prev.type === "op"
    )
      continue;
    if (!canEndStmt(prev)) continue;
    // 控制流 `)` 之后不补分号
    if (prev.type === "rparen") {
      const idx = toks.indexOf(prev);
      if (idx >= 0 && ctrlRparen.has(idx)) continue;
    }
    // `else` 关键字之后（无块体的形如 `if(x) y\nelse z`）—— prev 是 else 的话已经被
    // KEYWORDS_NO_ASI 拦掉了；这里额外保证 prev 是关键字时不补分号。
    if (!canStartStmt(nxt)) continue;
    // 在 prev 之后、当前 nl 之前插入分号
    for (let k = result.length - 2; k >= 0; k--) {
      const r = result[k]!;
      if (r === prev) {
        result.splice(k + 1, 0, { type: "semi", text: ";" });
        break;
      }
    }
  }
  return result;
}

/** 把 token 流渲染回字符串：处理空格、缩进、换行。 */
function render(toks: Tok[]): string {
  // 先做：紧凑化空白 / 换行 → 统一交给结构符控制
  // 简单策略：
  //   - 字符串 / 注释原样输出
  //   - 运算符两侧加单空格
  //   - `,` 后加空格
  //   - `{` 后换行并缩进；`}` 前减缩进并换行
  //   - `;` 后换行（for 头部已经不会再产生分号）
  //   - 关键字之间保留空格
  let out = "";
  let depth = 0;
  // for( 头部不换行
  const forStack: boolean[] = [];
  let parenDepth = 0;

  const lastChar = (): string => (out.length ? out[out.length - 1]! : "");
  const trimRightSpace = () => {
    out = out.replace(/[ \t]+$/, "");
  };
  const newline = () => {
    trimRightSpace();
    if (!out.endsWith("\n")) out += "\n";
    out += INDENT.repeat(depth);
  };
  const ensureSpace = () => {
    if (out.length === 0) return;
    const lc = lastChar();
    if (lc === " " || lc === "\n") return;
    out += " ";
  };

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!;
    const prev = prevSig(toks, i);

    if (t.type === "ws" || t.type === "nl") continue;

    if (t.type === "lcomment" || t.type === "bcomment") {
      ensureSpace();
      out += t.text;
      if (t.type === "lcomment") newline();
      continue;
    }

    if (t.type === "lbrace") {
      ensureSpace();
      out += "{";
      depth++;
      newline();
      continue;
    }
    if (t.type === "rbrace") {
      depth = Math.max(0, depth - 1);
      trimRightSpace();
      if (!out.endsWith("\n")) out += "\n";
      out += INDENT.repeat(depth) + "}";
      // `}` 后是否换行：取决于下一个有意义 token
      const nxt = nextSig(toks, i);
      if (!nxt) continue;
      if (
        nxt.type === "rparen" ||
        nxt.type === "rbracket" ||
        nxt.type === "rbrace"
      )
        continue;
      if (
        nxt.type === "punct" &&
        (nxt.text === "," || nxt.text === ":" || nxt.text === ".")
      )
        continue;
      if (nxt.type === "semi") continue;
      newline();
      continue;
    }
    if (t.type === "lparen") {
      const prevIsFor = prev?.type === "ident" && prev.text === "for";
      forStack.push(!!prevIsFor);
      parenDepth++;
      // 控制流 / 函数关键字与 `(` 之间加空格（符合常规风格）
      if (
        prev?.type === "ident" &&
        (prev.text === "if" ||
          prev.text === "for" ||
          prev.text === "while" ||
          prev.text === "switch" ||
          prev.text === "catch" ||
          prev.text === "return" ||
          prev.text === "typeof" ||
          prev.text === "void" ||
          prev.text === "delete" ||
          prev.text === "new" ||
          prev.text === "throw" ||
          prev.text === "await" ||
          prev.text === "yield" ||
          prev.text === "in" ||
          prev.text === "of")
      ) {
        ensureSpace();
      }
      out += "(";
      continue;
    }
    if (t.type === "rparen") {
      forStack.pop();
      parenDepth--;
      out += ")";
      continue;
    }
    if (t.type === "lbracket") {
      out += "[";
      continue;
    }
    if (t.type === "rbracket") {
      out += "]";
      continue;
    }

    if (t.type === "semi") {
      trimRightSpace();
      out += ";";
      // for( 头部里的分号不换行
      if (forStack.length > 0 && forStack[forStack.length - 1]) {
        out += " ";
      } else {
        newline();
      }
      continue;
    }

    if (t.type === "punct") {
      if (t.text === ",") {
        trimRightSpace();
        out += ", ";
        continue;
      }
      if (t.text === ".") {
        trimRightSpace();
        out += ".";
        continue;
      }
      if (t.text === ":") {
        trimRightSpace();
        out += ": ";
        continue;
      }
      out += t.text;
      continue;
    }

    if (t.type === "op") {
      // 一元 op：紧贴前一个 token，没有空格
      const isUnary =
        !prev ||
        prev.type === "op" ||
        prev.type === "lparen" ||
        prev.type === "lbracket" ||
        prev.type === "lbrace" ||
        prev.type === "semi" ||
        prev.type === "punct" ||
        (prev.type === "ident" && KEYWORDS_NO_ASI.has(prev.text));
      const isPostfix = (t.text === "++" || t.text === "--") && !isUnary;
      if (t.text === "++" || t.text === "--") {
        // 前缀：紧贴右侧；后缀：紧贴左侧
        if (isPostfix) {
          trimRightSpace();
          out += t.text;
        } else {
          ensureSpace();
          out += t.text;
        }
        continue;
      }
      if (
        isUnary &&
        (t.text === "+" || t.text === "-" || t.text === "!" || t.text === "~")
      ) {
        ensureSpace();
        out += t.text;
        continue;
      }
      // 二元运算符两侧加空格
      ensureSpace();
      out += t.text + " ";
      continue;
    }

    if (t.type === "string" || t.type === "number" || t.type === "ident") {
      // 与前一个标识符/数字/字符串/`)` `]` 之间需要空格
      if (prev) {
        const needSpace =
          prev.type === "ident" ||
          prev.type === "number" ||
          prev.type === "string" ||
          prev.type === "rparen" ||
          prev.type === "rbracket" ||
          prev.type === "rbrace";
        if (needSpace && !lastChar().match(/[\s({[]/)) ensureSpace();
      }
      out += t.text;
      continue;
    }
  }

  // 行尾清理
  return out
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, idx, arr) => !(l === "" && arr[idx - 1] === ""))
    .join("\n")
    .trim();
}

export function formatJs(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return "";
  const toks = tokenize(trimmed);
  const withSemi = insertSemicolons(toks);
  return render(withSemi);
}
