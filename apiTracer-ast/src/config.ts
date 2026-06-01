import path from 'node:path'
import picomatch from 'picomatch'
import type {
  ApiTracerAstPluginOptions,
  ClientRule,
  NormalizedClientRule,
  NormalizedConfig,
  ResolverOptions,
} from './types'

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

const DEFAULT_METHODS: NonNullable<ClientRule['methods']> = {
  get: { urlArg: 0, configArg: 1 },
  delete: { urlArg: 0, configArg: 1 },
  head: { urlArg: 0, configArg: 1 },
  options: { urlArg: 0, configArg: 1 },
  post: { urlArg: 0, dataArg: 1, configArg: 2 },
  put: { urlArg: 0, dataArg: 1, configArg: 2 },
  patch: { urlArg: 0, dataArg: 1, configArg: 2 },
}

export function normalizeConfig(
  raw: ApiTracerAstPluginOptions,
  rootDir = process.cwd(),
): NormalizedConfig {
  const clients = raw.clients?.length ? raw.clients : [{ methods: DEFAULT_METHODS }]
  const normalizedRootDir = normalizePath(path.resolve(rootDir))
  const resolver = normalizeResolver(raw.resolver, normalizedRootDir)
  return {
    rootDir: normalizedRootDir,
    include: normalizePatterns(raw.include, normalizedRootDir),
    exclude: normalizePatterns(raw.exclude || [], normalizedRootDir),
    headerName: raw.headerName || 'X-Request-Name',
    urlPrefixes: raw.urlPrefixes || [],
    defaultRequestName: raw.defaultRequestName || 'none-name',
    clients: clients.map((client) => normalizeClientRule(client, resolver, normalizedRootDir)),
    resolver,
    runtimeImport: raw.runtimeImport || 'api-tracer-ast/runtime',
  }
}

export function shouldTransformFile(filename: string, config: NormalizedConfig): boolean {
  const normalizedFilename = normalizePath(path.resolve(filename))
  if (!matchesPatterns(normalizedFilename, config.include)) return false
  if (config.exclude.length > 0 && matchesPatterns(normalizedFilename, config.exclude)) return false
  return true
}

export function resolveImportSource(
  source: string,
  importerFilename: string,
  config: NormalizedConfig,
): string {
  return resolvePathLike(source, config.rootDir, config.resolver, path.dirname(importerFilename))
}

export function matchClientFrom(
  importSource: string,
  importerFilename: string,
  client: NormalizedClientRule,
  config: NormalizedConfig,
): boolean {
  if (client.from.length === 0) return true
  const resolvedImportSource = resolveImportSource(importSource, importerFilename, config)
  return client.from.some((from) => isSameOrChild(resolvedImportSource, from, config.resolver.extensions))
}

export function mergeResolverOptions(
  primary: ResolverOptions | undefined,
  fallback: ResolverOptions | undefined,
): ResolverOptions | undefined {
  if (!primary && !fallback) return undefined
  return {
    alias: { ...(fallback?.alias || {}), ...(primary?.alias || {}) },
    extensions: primary?.extensions?.length ? primary.extensions : fallback?.extensions,
  }
}

function normalizeResolver(
  resolver: ResolverOptions | undefined,
  rootDir: string,
): Required<ResolverOptions> {
  return {
    alias: normalizeAlias(resolver?.alias || {}, rootDir),
    extensions: resolver?.extensions?.length ? resolver.extensions : DEFAULT_EXTENSIONS,
  }
}

function normalizeAlias(alias: Record<string, string>, rootDir: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(alias).map(([key, value]) => [
      normalizeAliasKey(key),
      normalizeAliasValue(value, rootDir),
    ]),
  )
}

function normalizeAliasKey(key: string): string {
  return key.endsWith('$') ? key.slice(0, -1) : key
}

function normalizeAliasValue(value: string, rootDir: string): string {
  if (isBareModule(value)) return value
  return normalizePath(path.isAbsolute(value) ? value : path.resolve(rootDir, value))
}

function normalizePatterns(patterns: string | string[], rootDir: string): string[] {
  return toArray(patterns)
    .filter(Boolean)
    .flatMap((pattern) => expandPattern(pattern, rootDir))
    .map(normalizePath)
}

function expandPattern(pattern: string, rootDir: string): string[] {
  if (hasGlob(pattern)) {
    return [absolutizePattern(pattern, rootDir)]
  }
  const absolute = path.resolve(rootDir, pattern)
  return [absolute, `${absolute}/**/*`]
}

function absolutizePattern(pattern: string, rootDir: string): string {
  if (path.isAbsolute(pattern)) return pattern
  return path.resolve(rootDir, pattern)
}

function matchesPatterns(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (!hasGlob(pattern)) return filename === pattern || filename.startsWith(`${pattern}/`)
    return picomatch.isMatch(filename, pattern, { dot: true })
  })
}

function hasGlob(pattern: string): boolean {
  return /[*?{}()[\]]/.test(pattern)
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function normalizeClientRule(
  rule: ClientRule,
  resolver: Required<ResolverOptions>,
  rootDir: string,
): NormalizedClientRule {
  const methods = rule.methods || DEFAULT_METHODS
  return {
    name: rule.name,
    from: toArray(rule.from).map((from) => resolvePathLike(from, rootDir, resolver)),
    methods: Object.fromEntries(
      Object.entries(methods).map(([method, methodRule]) => [
        method,
        { ...methodRule, method },
      ]),
    ),
    objectCall: {
      urlKey: rule.objectCall?.urlKey || 'url',
      headersKey: rule.objectCall?.headersKey || 'headers',
    },
  }
}

function resolvePathLike(
  value: string,
  rootDir: string,
  resolver: Required<ResolverOptions>,
  baseDir = rootDir,
): string {
  const normalizedValue = normalizePath(value)
  const aliased = applyAlias(normalizedValue, resolver.alias)
  if (isBareModule(aliased)) return aliased
  if (aliased.startsWith('.')) return normalizePath(path.resolve(baseDir, aliased))
  if (path.isAbsolute(aliased)) return normalizePath(aliased)
  return normalizePath(path.resolve(rootDir, aliased))
}

function applyAlias(value: string, alias: Record<string, string>): string {
  const matchedAlias = Object.keys(alias)
    .sort((left, right) => right.length - left.length)
    .find((key) => value === key || value.startsWith(`${key}/`))

  if (!matchedAlias) return value
  const target = alias[matchedAlias]
  const suffix = value.slice(matchedAlias.length)
  return normalizePath(`${target}${suffix}`)
}

function isSameOrChild(candidate: string, base: string, extensions: string[]): boolean {
  if (candidate === base) return true
  if (candidate.startsWith(`${base}/`)) return true
  return pathCandidates(base, extensions).some((baseCandidate) => candidate === baseCandidate)
}

function pathCandidates(filePath: string, extensions: string[]): string[] {
  if (isBareModule(filePath)) return []
  return extensions.map((extension) => `${filePath}${extension}`).concat(
    extensions.map((extension) => `${filePath}/index${extension}`),
  )
}

function isBareModule(value: string): boolean {
  return !value.startsWith('.') && !value.startsWith('/') && !value.match(/^[A-Za-z]:\//) && !value.includes('/')
}

export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}
