export interface ApiTracerRuntimeOptions {
  headerName: string
  requestName: string
  urlPrefixes: string[]
}

export interface ApiTracerInitOptions {
  packageName: string
  version: string
  urlPrefixes: string[]
}

const POST_MESSAGE_SOURCE = 'api-tracer'
let initialized = false

export function __apiTracerInit(options: ApiTracerInitOptions): void {
  if (initialized) return
  initialized = true
  console.log(`[${options.packageName}] 启动成功 ${options.version}`)
  if (typeof window === 'undefined') return
  try {
    window.postMessage(
      {
        source: POST_MESSAGE_SOURCE,
        type: 'config',
        payload: { apiPrefixes: options.urlPrefixes },
      },
      '*',
    )
  } catch {
  }
}

export function __apiTracerInjectConfig<T extends Record<string, unknown> | undefined | null>(
  config: T,
  url: unknown,
  options: ApiTracerRuntimeOptions,
): T | Record<string, unknown> {
  if (!urlMatchesPrefix(String(url || ''), options.urlPrefixes)) return config || {}
  const nextConfig: Record<string, unknown> = { ...(config || {}) }
  nextConfig.headers = injectHeader(nextConfig.headers, options.headerName, options.requestName)
  return nextConfig
}

export function __apiTracerInjectObjectConfig<T extends Record<string, unknown>>(
  config: T,
  options: ApiTracerRuntimeOptions,
  urlKey = 'url',
  headersKey = 'headers',
): T {
  if (!config || typeof config !== 'object') return config
  const url = config[urlKey]
  if (!urlMatchesPrefix(String(url || ''), options.urlPrefixes)) return config
  return {
    ...config,
    [headersKey]: injectHeader(config[headersKey], options.headerName, options.requestName),
  }
}

export function urlMatchesPrefix(url: string, prefixes: string[]): boolean {
  if (!url || !prefixes || prefixes.length === 0) return false
  for (const raw of prefixes) {
    if (!raw) continue
    const prefix = raw.trim()
    if (!prefix) continue
    if (/^https?:\/\//i.test(prefix)) {
      if (url.startsWith(prefix)) return true
      continue
    }
    const pathPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`
    try {
      const parsed = new URL(url, 'http://_api_tracer_')
      if (parsed.pathname.startsWith(pathPrefix)) return true
    } catch {
      if (url.startsWith(pathPrefix)) return true
    }
  }
  return false
}

function injectHeader(headers: unknown, headerName: string, requestName: string): Record<string, unknown> {
  if (headers && typeof headers === 'object') {
    return {
      ...(headers as Record<string, unknown>),
      [headerName]: encodeURIComponent(requestName),
    }
  }
  return { [headerName]: encodeURIComponent(requestName) }
}
