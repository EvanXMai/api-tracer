import { normalizeConfig } from './config'
import { transformCode } from './transform'
import type { ApiTracerAstPluginOptions, LoaderContextLike } from './types'

export default function apiTracerAstLoader(
  this: LoaderContextLike,
  source: string,
  inputMap?: unknown,
): void | string {
  const callback = this.callback
  try {
    const options = getLoaderOptions(this)
    const rootDir = this.rootContext || process.cwd()
    const filename = this.resourcePath || ''
    const config = normalizeConfig(options, rootDir)
    const result = transformCode(source, filename, config)

    if (callback) {
      callback(null, result.code, result.map || inputMap)
      return undefined
    }
    return result.code
  } catch (error) {
    if (callback) {
      callback(error instanceof Error ? error : new Error(String(error)))
      return undefined
    }
    throw error
  }
}

function getLoaderOptions(context: LoaderContextLike): ApiTracerAstPluginOptions {
  if (typeof context.getOptions === 'function') return context.getOptions()
  if (context.query && typeof context.query === 'object') return context.query as ApiTracerAstPluginOptions
  return { include: [], urlPrefixes: [] }
}
