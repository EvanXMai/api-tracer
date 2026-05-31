/**
 * 把任意 JSON 值渲染为可折叠的树形结构（类似 Chrome Network 的 Preview）。
 *
 * 设计：
 * - 每个节点是一个 <div class="json-node">，含 .json-line 和 .json-children
 * - 复合节点（对象/数组）默认展开；点击切换 .collapsed
 * - 折叠时用 .json-summary 显示简略形态（如 {…} / [3]）
 */

interface RenderOpts {
  /** 节点折叠时显示的键名（数组项是索引） */
  key?: string | number
  /** 是否是父节点的最后一项（用于尾部逗号渲染） */
  isLast?: boolean
}

export function renderJsonTree(value: unknown, container: HTMLElement): void {
  container.innerHTML = ''
  const root = buildNode(value, { isLast: true })
  root.classList.add('root')
  container.appendChild(root)
}

function buildNode(value: unknown, opts: RenderOpts): HTMLElement {
  const node = document.createElement('div')
  node.className = 'json-node'

  const line = document.createElement('div')
  line.className = 'json-line'
  node.appendChild(line)

  const isObj = value !== null && typeof value === 'object'
  const isArr = Array.isArray(value)

  // 1. 展开/折叠按钮（仅复合节点）；无论是否复合，都占同样宽度的 gutter，保证对齐
  const gutter = document.createElement('span')
  gutter.className = isObj ? 'json-gutter toggle' : 'json-gutter'
  if (isObj) {
    gutter.addEventListener('click', (e) => {
      e.stopPropagation()
      node.classList.toggle('collapsed')
    })
  }
  line.appendChild(gutter)

  // 2. 键名
  if (opts.key !== undefined) {
    const k = document.createElement('span')
    k.className = 'json-key'
    k.textContent = typeof opts.key === 'number' ? String(opts.key) : JSON.stringify(opts.key)
    line.appendChild(k)
    line.appendChild(text(': ', 'json-punct'))
  }

  // 3. 值
  if (isObj) {
    const entries = isArr
      ? (value as unknown[]).map((v, i) => [i, v] as const)
      : Object.entries(value as Record<string, unknown>)

    line.appendChild(text(isArr ? '[' : '{', 'json-punct'))

    // 折叠摘要
    const summary = document.createElement('span')
    summary.className = 'json-summary'
    summary.textContent = isArr
      ? `${entries.length} items`
      : `${entries.length} keys`
    line.appendChild(summary)

    line.appendChild(text(isArr ? ']' : '}', 'json-punct json-close'))

    // 子节点
    const children = document.createElement('div')
    children.className = 'json-children'
    entries.forEach(([k, v], idx) => {
      const child = buildNode(v, {
        key: k as string | number,
        isLast: idx === entries.length - 1,
      })
      children.appendChild(child)
    })
    node.appendChild(children)

    // 闭合括号在子节点之后（对齐用同样的 gutter 占位）
    const closer = document.createElement('div')
    closer.className = 'json-line'
    const phClose = document.createElement('span')
    phClose.className = 'json-gutter'
    closer.appendChild(phClose)
    closer.appendChild(text(isArr ? ']' : '}', 'json-punct'))
    if (!opts.isLast) closer.appendChild(text(',', 'json-punct'))
    node.appendChild(closer)
  } else {
    line.appendChild(renderPrimitive(value))
    if (!opts.isLast) line.appendChild(text(',', 'json-punct'))
  }

  return node
}

function renderPrimitive(value: unknown): HTMLElement {
  const span = document.createElement('span')
  if (value === null) {
    span.className = 'json-null'
    span.textContent = 'null'
  } else if (typeof value === 'string') {
    span.className = 'json-string'
    span.textContent = JSON.stringify(value)
  } else if (typeof value === 'number') {
    span.className = 'json-number'
    span.textContent = String(value)
  } else if (typeof value === 'boolean') {
    span.className = 'json-boolean'
    span.textContent = String(value)
  } else {
    span.className = 'json-null'
    span.textContent = String(value)
  }
  return span
}

function text(s: string, cls: string): HTMLElement {
  const span = document.createElement('span')
  span.className = cls
  span.textContent = s
  return span
}
