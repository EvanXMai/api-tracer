/**
 * 简易 JS 语法高亮（覆盖关键字 / 字符串 / 数字 / 注释 / 运算符）。
 * 输出 HTML 字符串，与 textarea 叠层渲染。
 */

const KEYWORDS = new Set([
  'function', 'return', 'if', 'else', 'var', 'let', 'const',
  'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'try', 'catch', 'finally', 'for', 'while', 'do',
  'switch', 'case', 'default', 'break', 'continue', 'this',
  'class', 'extends', 'super', 'import', 'export', 'from', 'as',
  'await', 'async', 'yield',
])
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity'])

const OPS3 = ['===', '!==', '...', '**=', '>>>', '<<=', '>>=']
const OPS2 = [
  '==', '!=', '>=', '<=', '=>', '&&', '||', '??',
  '++', '--', '+=', '-=', '*=', '/=', '%=', '**', '>>', '<<',
]

export function highlightJs(code: string): string {
  let out = ''
  let i = 0
  const len = code.length

  while (i < len) {
    const c = code[i]!
    const next = code[i + 1]

    // 行注释
    if (c === '/' && next === '/') {
      const end = code.indexOf('\n', i)
      const e = end === -1 ? len : end
      out += span('comment', code.slice(i, e))
      i = e
      continue
    }
    // 块注释
    if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      const e = end === -1 ? len : end + 2
      out += span('comment', code.slice(i, e))
      i = e
      continue
    }
    // 字符串
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < len) {
        if (code[j] === '\\') { j += 2; continue }
        if (code[j] === c) { j++; break }
        j++
      }
      out += span('string', code.slice(i, j))
      i = j
      continue
    }
    // 数字
    if (/[0-9]/.test(c)) {
      let j = i
      while (j < len && /[0-9._eE+\-xXa-fA-F]/.test(code[j]!)) j++
      out += span('number', code.slice(i, j))
      i = j
      continue
    }
    // 标识符 / 关键字
    if (/[a-zA-Z_$]/.test(c)) {
      let j = i
      while (j < len && /[a-zA-Z0-9_$]/.test(code[j]!)) j++
      const word = code.slice(i, j)
      if (KEYWORDS.has(word)) out += span('keyword', word)
      else if (LITERALS.has(word)) out += span('literal', word)
      else out += escapeHtml(word)
      i = j
      continue
    }
    // 多字符运算符
    if (i + 2 < len && OPS3.includes(code.slice(i, i + 3))) {
      out += span('punct', code.slice(i, i + 3))
      i += 3
      continue
    }
    if (i + 1 < len && OPS2.includes(code.slice(i, i + 2))) {
      out += span('punct', code.slice(i, i + 2))
      i += 2
      continue
    }
    // 单字符运算符 / 标点
    if (/[=<>!&|?:;,.+\-*/%(){}\[\]~^]/.test(c)) {
      out += span('punct', c)
      i++
      continue
    }
    // 其他（空白）
    out += escapeHtml(c)
    i++
  }
  return out
}

function span(cls: string, text: string): string {
  return `<span class="tok-${cls}">${escapeHtml(text)}</span>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
