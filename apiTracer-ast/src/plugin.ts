import { mergeResolverOptions, normalizeConfig } from './config'
import { transformCode } from './transform'
import type { ApiTracerAstPluginOptions, NormalizedConfig, ResolverOptions } from './types'

interface CompilerLike {
  options?: {
    context?: string
    module?: { rules?: unknown[] }
    resolve?: CompilerResolveOptions
  }
  hooks?: {
    compilation?: { tap: (name: string, handler: (compilation: CompilationLike) => void) => void }
  }
}

interface CompilerResolveOptions {
  alias?: Record<string, string | false | string[]> | Array<{ name?: string; alias?: string | false | string[] }>
  extensions?: string[]
}

interface CompilationLike {
  hooks?: {
    normalModuleLoader?: {
      tap: (name: string, handler: (loaderContext: Record<string, unknown>, module: ModuleLike) => void) => void
    }
  }
}

interface ModuleLike {
  resource?: string
}

export class ApiTracerAstPlugin {
  private readonly options: ApiTracerAstPluginOptions

  constructor(options: ApiTracerAstPluginOptions) {
    this.options = options
  }

  apply(compiler: CompilerLike): void {
    const rootDir = compiler.options?.context || process.cwd()
    const options = this.mergeCompilerResolver(compiler.options?.resolve)
    const config = normalizeConfig(options, rootDir)
    if (this.injectWebpackLoader(compiler, config, options)) return
    this.installFallbackTransform(compiler, config)
  }

  private mergeCompilerResolver(resolve: CompilerResolveOptions | undefined): ApiTracerAstPluginOptions {
    const compilerResolver = normalizeCompilerResolver(resolve)
    return {
      ...this.options,
      resolver: mergeResolverOptions(this.options.resolver, compilerResolver),
    }
  }

  private injectWebpackLoader(
    compiler: CompilerLike,
    config: NormalizedConfig,
    options: ApiTracerAstPluginOptions,
  ): boolean {
    const rules = compiler.options?.module?.rules
    if (!Array.isArray(rules)) return false
    rules.unshift({
      test: /\.[cm]?[jt]sx?$/,
      enforce: 'pre',
      use: [
        {
          loader: 'api-tracer-ast/loader',
          options,
        },
      ],
      include: config.include,
      exclude: config.exclude,
    })
    return true
  }

  private installFallbackTransform(compiler: CompilerLike, config: NormalizedConfig): void {
    compiler.hooks?.compilation?.tap('ApiTracerAstPlugin', (compilation) => {
      compilation.hooks?.normalModuleLoader?.tap('ApiTracerAstPlugin', (loaderContext, module) => {
        const previous = loaderContext.transformSource
        loaderContext.transformSource = (source: string) => {
          const filename = module.resource || ''
          const result = transformCode(source, filename, config)
          return typeof previous === 'function' ? previous(result.code) : result.code
        }
      })
    })
  }
}

function normalizeCompilerResolver(resolve: CompilerResolveOptions | undefined): ResolverOptions | undefined {
  if (!resolve) return undefined
  const alias = normalizeCompilerAlias(resolve.alias)
  return {
    alias,
    extensions: resolve.extensions,
  }
}

function normalizeCompilerAlias(alias: CompilerResolveOptions['alias']): Record<string, string> {
  if (!alias) return {}
  if (Array.isArray(alias)) {
    return Object.fromEntries(
      alias
        .filter((item) => item.name && typeof item.alias === 'string')
        .map((item) => [item.name as string, item.alias as string]),
    )
  }
  return Object.fromEntries(
    Object.entries(alias)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string]),
  )
}

export default ApiTracerAstPlugin
