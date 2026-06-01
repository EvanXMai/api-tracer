import path from 'node:path'
import generateModule from '@babel/generator'
import { parse } from '@babel/parser'
import traverseModule, { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import pkg from '../package.json'
import { matchClientFrom, normalizeConfig, normalizePath, shouldTransformFile } from './config'
import type {
  ApiTracerAstPluginOptions,
  NormalizedClientRule,
  NormalizedConfig,
  TransformResult,
} from './types'

const DEFAULT_RUNTIME_IMPORT = 'api-tracer-ast/runtime'
const INJECT_CONFIG = '__apiTracerInjectConfig'
const INJECT_OBJECT_CONFIG = '__apiTracerInjectObjectConfig'
const INIT = '__apiTracerInit'
const generate = resolveDefaultExport(generateModule)
const traverse = resolveDefaultExport(traverseModule)
const PACKAGE_NAME = pkg.name
const PACKAGE_VERSION = pkg.version

interface ImportedClient {
  localName: string
  rule: NormalizedClientRule
  source?: string
}

function resolveDefaultExport<T>(module: T): T {
  const maybeDefault = module as T & { default?: T }
  return maybeDefault.default || module
}

export function transformCode(
  code: string,
  filename: string,
  configOrOptions: NormalizedConfig | ApiTracerAstPluginOptions,
): TransformResult {
  const config = isNormalizedConfig(configOrOptions)
    ? configOrOptions
    : normalizeConfig(configOrOptions, process.cwd())
  const normalizedFilename = normalizePath(path.resolve(filename))
  if (!shouldTransformFile(normalizedFilename, config)) {
    return { code, map: null, changed: false }
  }

  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'dynamicImport'],
  })

  const importedClients = new Map<string, ImportedClient>()
  let changed = false
  let needsRuntimeImport = false

  traverse(ast, {
    ImportDeclaration(importPath) {
      const source = importPath.node.source.value
      for (const specifier of importPath.node.specifiers) {
        if (!t.isImportDefaultSpecifier(specifier) && !t.isImportSpecifier(specifier)) continue
        const localName = specifier.local.name
        const rule = findClientRule(localName, source, normalizedFilename, config)
        if (rule) importedClients.set(localName, { localName, rule, source })
      }
    },
  })

  traverse(ast, {
    CallExpression(callPath) {
      if (isRuntimeCall(callPath.node)) return
      const requestName = getEnclosingFunctionName(callPath) || config.defaultRequestName

      const methodTransform = buildMethodCallTransform(callPath, importedClients, requestName, config)
      if (methodTransform) {
        changed = true
        needsRuntimeImport = true
        return
      }

      const objectTransform = buildObjectCallTransform(callPath, importedClients, requestName, config)
      if (objectTransform) {
        changed = true
        needsRuntimeImport = true
      }
    },
  })

  if (!changed) return { code, map: null, changed: false }
  if (needsRuntimeImport) {
    addRuntimeImport(ast.program, config)
    addRuntimeInit(ast.program, config)
  }

  const output = generate(ast, { sourceMaps: true, sourceFileName: filename }, code)
  return { code: output.code, map: output.map, changed: true }
}

function buildMethodCallTransform(
  callPath: NodePath<t.CallExpression>,
  clients: Map<string, ImportedClient>,
  requestName: string,
  config: NormalizedConfig,
): boolean {
  const callee = callPath.node.callee
  if (!t.isMemberExpression(callee)) return false
  if (!t.isIdentifier(callee.object)) return false
  const client = clients.get(callee.object.name) || findClientByMethod(callee.object.name, config)
  if (!client) return false
  const method = memberName(callee.property)
  if (!method) return false
  const rule = client.rule.methods[method]
  if (!rule) return false

  const args = callPath.node.arguments
  const urlArg = args[rule.urlArg]
  if (!urlArg || !isExpressionArgument(urlArg)) return false
  ensureArgsLength(args, rule.configArg)
  const currentConfig = args[rule.configArg]
  if (currentConfig && !isExpressionArgument(currentConfig)) return false
  args[rule.configArg] = buildInjectConfigCall(
    currentConfig || t.objectExpression([]),
    urlArg,
    requestName,
    config,
  )
  return true
}

function buildObjectCallTransform(
  callPath: NodePath<t.CallExpression>,
  clients: Map<string, ImportedClient>,
  requestName: string,
  config: NormalizedConfig,
): boolean {
  const callee = callPath.node.callee
  if (!t.isIdentifier(callee)) return false
  const client = clients.get(callee.name) || findClientByName(callee.name, config)
  if (!client) return false
  const firstArg = callPath.node.arguments[0]
  if (!firstArg || !isExpressionArgument(firstArg)) return false
  callPath.node.arguments[0] = t.callExpression(t.identifier(INJECT_OBJECT_CONFIG), [
    firstArg,
    buildOptionsObject(requestName, config),
    t.stringLiteral(client.rule.objectCall.urlKey),
    t.stringLiteral(client.rule.objectCall.headersKey),
  ])
  return true
}

function buildInjectConfigCall(
  configArg: t.Expression,
  urlArg: t.Expression,
  requestName: string,
  config: NormalizedConfig,
): t.CallExpression {
  return t.callExpression(t.identifier(INJECT_CONFIG), [
    configArg,
    urlArg,
    buildOptionsObject(requestName, config),
  ])
}

function buildOptionsObject(requestName: string, config: NormalizedConfig): t.ObjectExpression {
  return t.objectExpression([
    t.objectProperty(t.identifier('headerName'), t.stringLiteral(config.headerName)),
    t.objectProperty(t.identifier('requestName'), t.stringLiteral(requestName)),
    t.objectProperty(
      t.identifier('urlPrefixes'),
      t.arrayExpression(config.urlPrefixes.map((prefix) => t.stringLiteral(prefix))),
    ),
  ])
}

function ensureArgsLength(args: t.CallExpression['arguments'], index: number): void {
  while (args.length <= index) args.push(t.objectExpression([]))
}

function isExpressionArgument(arg: t.CallExpression['arguments'][number]): arg is t.Expression {
  return !t.isSpreadElement(arg) && !t.isArgumentPlaceholder(arg)
}

function getEnclosingFunctionName(callPath: NodePath<t.CallExpression>): string {
  const functionPath = callPath.getFunctionParent()
  if (!functionPath) return ''
  const node = functionPath.node
  if (t.isFunctionDeclaration(node) && node.id?.name) return node.id.name
  if ((t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) && t.isVariableDeclarator(functionPath.parent)) {
    const id = functionPath.parent.id
    if (t.isIdentifier(id)) return id.name
  }
  if ((t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) && t.isObjectProperty(functionPath.parent)) {
    return memberName(functionPath.parent.key)
  }
  return ''
}

function findClientRule(
  localName: string,
  importSource: string,
  importerFilename: string,
  config: NormalizedConfig,
): NormalizedClientRule | null {
  return config.clients.find((client) => {
    if (client.name && client.name !== localName) return false
    return matchClientFrom(importSource, importerFilename, client, config)
  }) || null
}

function findClientByName(localName: string, config: NormalizedConfig): ImportedClient | null {
  const rule = config.clients.find((client) => {
    if (client.from.length > 0) return false
    return !client.name || client.name === localName
  })
  return rule ? { localName, rule } : null
}

function findClientByMethod(localName: string, config: NormalizedConfig): ImportedClient | null {
  return findClientByName(localName, config)
}

function memberName(node: t.PrivateName | t.Expression): string {
  if (t.isIdentifier(node)) return node.name
  if (t.isStringLiteral(node)) return node.value
  return ''
}

function isRuntimeCall(node: t.CallExpression): boolean {
  return t.isIdentifier(node.callee) && (
    node.callee.name === INJECT_CONFIG ||
    node.callee.name === INJECT_OBJECT_CONFIG ||
    node.callee.name === INIT
  )
}

function addRuntimeImport(program: t.Program, config: NormalizedConfig): void {
  const runtimeImport = config.runtimeImport || DEFAULT_RUNTIME_IMPORT
  const alreadyImported = program.body.some(
    (node) => t.isImportDeclaration(node) && node.source.value === runtimeImport,
  )
  if (alreadyImported) return
  program.body.unshift(
    t.importDeclaration(
      [
        t.importSpecifier(t.identifier(INIT), t.identifier(INIT)),
        t.importSpecifier(t.identifier(INJECT_CONFIG), t.identifier(INJECT_CONFIG)),
        t.importSpecifier(t.identifier(INJECT_OBJECT_CONFIG), t.identifier(INJECT_OBJECT_CONFIG)),
      ],
      t.stringLiteral(runtimeImport),
    ),
  )
}

function addRuntimeInit(program: t.Program, config: NormalizedConfig): void {
  const alreadyInitialized = program.body.some(
    (node) => t.isExpressionStatement(node) &&
      t.isCallExpression(node.expression) &&
      t.isIdentifier(node.expression.callee, { name: INIT }),
  )
  if (alreadyInitialized) return
  const initStatement = t.expressionStatement(
    t.callExpression(t.identifier(INIT), [
      t.objectExpression([
        t.objectProperty(t.identifier('packageName'), t.stringLiteral(PACKAGE_NAME)),
        t.objectProperty(t.identifier('version'), t.stringLiteral(PACKAGE_VERSION)),
        t.objectProperty(
          t.identifier('urlPrefixes'),
          t.arrayExpression(config.urlPrefixes.map((prefix) => t.stringLiteral(prefix))),
        ),
      ]),
    ]),
  )
  let lastImportIndex = -1
  for (let index = 0; index < program.body.length; index += 1) {
    if (t.isImportDeclaration(program.body[index])) lastImportIndex = index
  }
  program.body.splice(lastImportIndex + 1, 0, initStatement)
}

function isNormalizedConfig(config: NormalizedConfig | ApiTracerAstPluginOptions): config is NormalizedConfig {
  return 'rootDir' in config && 'defaultRequestName' in config && 'resolver' in config
}
