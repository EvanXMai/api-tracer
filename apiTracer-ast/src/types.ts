export interface MethodCallRule {
  urlArg: number
  dataArg?: number
  configArg: number
}

export interface ObjectCallRule {
  urlKey?: string
  headersKey?: string
}

export interface ClientRule {
  name?: string
  from?: string | string[]
  methods?: Record<string, MethodCallRule>
  objectCall?: ObjectCallRule
}

export interface ResolverOptions {
  alias?: Record<string, string>
  extensions?: string[]
}

export interface ApiTracerAstPluginOptions {
  include: string | string[]
  exclude?: string | string[]
  headerName?: string
  urlPrefixes: string[]
  defaultRequestName?: string
  clients?: ClientRule[]
  resolver?: ResolverOptions
}

export type ApiTracerAstConfig = ApiTracerAstPluginOptions

export interface NormalizedMethodCallRule extends MethodCallRule {
  method: string
}

export interface NormalizedClientRule {
  name?: string
  from: string[]
  methods: Record<string, NormalizedMethodCallRule>
  objectCall: Required<ObjectCallRule>
}

export interface NormalizedConfig {
  rootDir: string
  include: string[]
  exclude: string[]
  headerName: string
  urlPrefixes: string[]
  defaultRequestName: string
  clients: NormalizedClientRule[]
  resolver: Required<ResolverOptions>
}

export interface TransformResult {
  code: string
  map: unknown
  changed: boolean
}

export interface LoaderContextLike {
  resourcePath?: string
  rootContext?: string
  query?: unknown
  getOptions?: () => ApiTracerAstPluginOptions
  callback?: (error: Error | null, code?: string, map?: unknown) => void
}
