/**
 * 极简 JS 代码格式化器（仅做缩进/换行/运算符空格整理，不解析 AST）。
 * 适用于用户输入的简短表达式 / 单语句箭头函数。
 *
 * 规则：
 *  - 字符串内部不动
 *  - "{" 后换行并增加缩进；"}" 前减缩进并换行
 *  - ";" 后换行（除字符串/for 语句之外，简化处理）
 *  - 多个连续空白合并为单个空格（字符串外）
 *  - 运算符两侧补空格（=>、===、!==、&&、||、<=、>=、??、=、<、>）
 *  - 宽松等于升级为严格等于：== → ===，!= → !==
 *  - "," 后强制补一个空格
 */

const INDENT = '  '

/** 在运算符两侧补空格；同时把 == 升级为 ===、!= 升级为 !==。 */
function spaceOps(src: string): string {
  // [匹配, 替换]，越长越靠前以避免 === 被错切成 ==
  const OPS: Array<[string, string]> = [
    ['===', '==='],
    ['!==', '!=='],
    ['==', '==='], // 升级
    ['!=', '!=='], // 升级
    ['=>', '=>'],
    ['&&', '&&'],
    ['||', '||'],
    ['<=', '<='],
    ['>=', '>='],
    ['??', '??'],
    ['=', '='],
    ['<', '<'],
    ['>', '>'],
  ]

  let out = ''
  let inStr: string | null = null
  let i = 0

  while (i < src.length) {
    const c = src[i]!

    if (inStr) {
      out += c
      if (c === '\\' && i + 1 < src.length) {
        out += src[i + 1]
        i += 2
        continue
      }
      if (c === inStr) inStr = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c
      out += c
      i++
      continue
    }

    let matched = false
    for (const [op, repl] of OPS) {
      if (src.startsWith(op, i)) {
        out = out.replace(/[ \t]+$/, '')
        out += ' ' + repl + ' '
        i += op.length
        matched = true
        break
      }
    }
    if (matched) continue

    if (c === ',') {
      out = out.replace(/[ \t]+$/, '')
      out += ', '
      i++
      continue
    }

    out += c
    i++
  }
  return out
}

export function formatJs(src: string): string {
  const pre = spaceOps(src.trim())
  const s = pre.trim()
  if (!s) return ''

  // 第一步：在结构符前后加入换行标记
  let out = ''
  let depth = 0
  let inStr: string | null = null
  let prevSpace = false

  const writeNewline = () => {
    out = out.replace(/[ \t]+$/, '')
    out += '\n' + INDENT.repeat(depth)
    prevSpace = false
  }

  for (let i = 0; i < s.length; i++) {
    const c = s[i]!

    // 字符串内逐字保留
    if (inStr) {
      out += c
      if (c === '\\' && i + 1 < s.length) {
        out += s[++i]
        continue
      }
      if (c === inStr) inStr = null
      continue
    }

    if (c === '"' || c === "'" || c === '`') {
      inStr = c
      out += c
      prevSpace = false
      continue
    }

    if (c === '{') {
      out += '{'
      depth++
      writeNewline()
      continue
    }
    if (c === '}') {
      depth = Math.max(0, depth - 1)
      out = out.replace(/[ \t]*$/, '')
      if (!out.endsWith('\n') && out.length > 0) {
        out += '\n' + INDENT.repeat(depth)
      } else {
        out = out.replace(/[ \t]*$/, '') + INDENT.repeat(depth)
      }
      out += '}'
      continue
    }
    if (c === ';') {
      out += ';'
      writeNewline()
      continue
    }
    if (/\s/.test(c)) {
      if (prevSpace || out.endsWith('\n')) continue
      out += ' '
      prevSpace = true
      continue
    }

    out += c
    prevSpace = false
  }

  // 清理：去除尾随空白与多余空行
  return out
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l, idx, arr) => !(l === '' && arr[idx - 1] === ''))
    .join('\n')
    .trim()
}
