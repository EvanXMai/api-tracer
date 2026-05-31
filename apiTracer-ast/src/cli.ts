#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { normalizeConfig } from './config'
import { transformCode } from './transform'
import type { ApiTracerAstPluginOptions } from './types'

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.file) {
    printUsage()
    process.exitCode = 1
    return
  }

  const rootDir = args.root || process.cwd()
  const include = args.include ? args.include.split(',') : [args.file]
  const urlPrefixes = args.prefix ? args.prefix.split(',') : []
  const options: ApiTracerAstPluginOptions = {
    include,
    urlPrefixes,
    defaultRequestName: args.defaultName,
  }
  const config = normalizeConfig(options, rootDir)
  const code = readFileSync(args.file, 'utf8')
  const result = transformCode(code, args.file, config)
  process.stdout.write(result.code)
}

function parseArgs(args: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg) continue
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = args[i + 1]
      if (value && !value.startsWith('--')) {
        out[key] = value
        i += 1
      } else {
        out[key] = 'true'
      }
    }
  }
  return out
}

function printUsage(): void {
  process.stderr.write(
    '用法：api-tracer-ast --file <源码文件> --prefix /api[,/gateway] [--include src/api,src/pages] [--root <项目根目录>] [--defaultName none-name]\n' +
      '说明：CLI 仅用于调试单文件转换结果，正式接入请使用 ApiTracerAstPlugin 或 api-tracer-ast/loader。\n',
  )
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
