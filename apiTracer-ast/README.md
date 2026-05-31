# api-tracer-ast

## 介绍

`api-tracer-ast` 是 ApiTracer 的构建期 npm 包，负责在开发构建阶段自动识别 axios-like 请求调用，并为命中 API 前缀的请求注入 `X-Request-Name` 请求头。它不会直接修改业务源码文件，而是在构建产物中完成注入，适合希望保持源码零侵入、但又需要在 ApiTracer 浏览器插件中看到接口函数名的前端项目。

本包需要配合 [ApiTracer 浏览器插件](../apiTracer-plugin) 使用；完整产品说明见 [ApiTracer 根目录 README](../README.md)。

## 安装

```bash
npm install api-tracer-ast@latest --save-dev
```

```bash
yarn add api-tracer-ast@latest--dev
```

```bash
pnpm add api-tracer-ast@latest -D
```

## 快速接入

### Plugin 方式

```js
const { ApiTracerAstPlugin } = require('api-tracer-ast/plugin')

module.exports = {
  resolve: {
    alias: {
      '@': 'src',
      '@api': 'src/api'
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  plugins: [
    new ApiTracerAstPlugin({
      include: ['src/api', 'src/pages'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
      urlPrefixes: ['/api', '/gateway'],
      defaultRequestName: 'none-name',
      clients: [
        {
          name: 'request',
          from: ['@api/request', '@/utils/request', 'src/request']
        },
        {
          name: 'axios',
          from: 'axios'
        }
      ]
    })
  ]
}
```

`clients[].from` 用来校验请求客户端来源，建议配置。这样只有从指定模块导入的 `request`、`axios` 才会被转换，普通工具函数 `request()` 不会被误判。

Plugin 方式会自动读取构建工具里的 `resolve.alias` 和 `resolve.extensions`，一般不需要在 `ApiTracerAstPlugin` 中重复配置 `resolver`。

### Loader 方式

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        enforce: 'pre',
        use: {
          loader: 'api-tracer-ast/loader',
          options: {
            include: ['src/api', 'src/pages'],
            exclude: ['**/*.test.ts'],
            urlPrefixes: ['/api'],
            defaultRequestName: 'none-name',
            clients: [
              {
                name: 'request',
                from: ['@api/request', 'src/request']
              }
            ],
            resolver: {
              alias: {
                '@': 'src',
                '@api': 'src/api'
              },
              extensions: ['.ts', '.tsx', '.js', '.jsx']
            }
          }
        }
      }
    ]
  }
}
```

Loader 单独使用时不一定能拿到构建工具完整 `resolve` 配置。如果 `clients[].from` 使用 alias，建议在 loader `options.resolver` 中手动补充。

从 `0.2.0` 开始，不再支持 `apitracer.config.json`。所有配置都写在 plugin 或 loader 的 `options` 中。

## 配置参数

- `include`：必填，字符串或字符串数组。声明需要转换的文件或目录，支持子目录和 glob，例如 `src/api`、`src/pages/**/*.tsx`。
- `exclude`：选填，字符串或字符串数组。声明排除范围，支持 glob。
- `urlPrefixes`：必填，需要注入请求头的 URL 前缀，也会发送给 ApiTracer 插件作为 `apiPrefixes`。
- `headerName`：选填，默认 `X-Request-Name`。
- `defaultRequestName`：选填，默认 `none-name`。当请求不在具名接口函数中，例如文件顶层直接 `request.get(...)`，使用该值作为接口名称。
- `clients`：选填，请求客户端规则。不配置时使用默认 axios-like 规则。
- `clients[].name`：选填，请求客户端本地变量名，例如 `request`、`http`、`axios`。不配置时匹配所有成员调用客户端，存在误判风险，建议明确配置。
- `clients[].from`：选填但强烈建议配置。声明请求客户端的 import 来源，支持字符串或数组，例如 `src/api`、`src/request`、`@api/request`、`axios`。
- `clients[].methods`：选填，声明 `request.get(url, config)`、`request.post(url, data, config)` 等方法的参数位置。
- `clients[].objectCall`：选填，声明 `request({ url, headers })` 对象式调用中的字段名。
- `resolver.alias`：选填，路径别名，例如 `{ "@api": "src/api", "@": "src" }`。Plugin 方式会优先复用构建工具的 alias，手动配置用于兜底或覆盖。
- `resolver.extensions`：选填，默认 `['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']`。Plugin 方式会优先复用构建工具的 extensions，手动配置用于兜底或覆盖。

默认 axios-like 方法规则：

```js
{
  get: { urlArg: 0, configArg: 1 },
  delete: { urlArg: 0, configArg: 1 },
  head: { urlArg: 0, configArg: 1 },
  options: { urlArg: 0, configArg: 1 },
  post: { urlArg: 0, dataArg: 1, configArg: 2 },
  put: { urlArg: 0, dataArg: 1, configArg: 2 },
  patch: { urlArg: 0, dataArg: 1, configArg: 2 }
}
```

## client.from 和 resolver

`clients[].from` 解决的是“变量名相同但来源不同”的误判问题。例如项目里同时存在请求实例和普通工具函数：

```ts
import { request } from '@api/request'
import { request as formatRequest } from '@/utils/request'
```

配置来源后，只有来源命中的客户端会被转换，匹配规则：

- `from: 'src/api'` 会匹配 `src/api` 目录及其子路径，例如 `src/api/a/request`。
- `from: 'src/api/request'` 会匹配该文件路径，省略扩展名也可以匹配 `.ts`、`.tsx`、`.js` 等后缀。
- `from: '@api/request'` 会通过 `resolver.alias` 或构建工具 `resolve.alias` 解析后再匹配。
- `from: 'axios'` 会按包名匹配裸模块导入。

Plugin 方式的 resolver 优先级：

1. `ApiTracerAstPlugin` 中手动写的 `resolver`
2. 构建工具已有的 `resolve.alias` / `resolve.extensions`
3. 包内默认 extensions

## 支持的代码形式

### 接口函数内请求

源码：

```ts
import { request } from '@api/request'

export function reset(params) {
  return request.post('/api/reset', params)
}
```

转换后会注入接口函数名：

```ts
request.post('/api/reset', params, {
  headers: {
    'X-Request-Name': 'reset'
  }
})
```

### 目录子级文件

如果配置：

```js
include: ['api']
```

则 `api/aa/b/reset.ts` 会被处理。`include` 使用目录前缀和 glob 匹配，子目录默认包含。

### 直接调用请求

源码：

```ts
import axios from 'axios'

axios.get('/api/list')
```

如果该文件命中 `include`，但请求不在具名函数中，则使用默认接口名：

```ts
axios.get('/api/list', {
  headers: {
    'X-Request-Name': 'none-name'
  }
})
```

可通过 `defaultRequestName` 改成其他值。

### 对象式调用

源码：

```ts
request({
  url: '/api/list',
  method: 'get'
})
```

转换后会合并 `headers`，并在运行时判断 URL 是否匹配 `urlPrefixes`。


## 生产环境

该包会改变构建产物，因此建议只在开发环境启用：

```js
const { ApiTracerAstPlugin } = require('api-tracer-ast/plugin')
const isDev = process.env.NODE_ENV !== 'production'
module.exports = {
  plugins: [
    ...(isDev
      ? [
          new ApiTracerAstPlugin({
            include: ['src/api', 'src/pages'],
            exclude: ['**/*.test.ts', '**/*.spec.ts'],
            urlPrefixes: ['/api'],
            defaultRequestName: 'none-name',
            clients: [
              {
                name: 'request',
                from: ['@api/request', 'src/request']
              }
            ]
          })
        ]
      : [])
  ]
}
```

生产环境不启用时，不会注入请求头、不会向插件发送配置、不会输出启动日志。

## CLI 调试

CLI 仅用于调试单个文件的转换结果，正式接入项目请使用 plugin 或 loader。CLI 会把转换后的代码输出到 stdout，不会覆盖源文件。

### 基本用法

```bash
npx api-tracer-ast --file src/api/user.ts --prefix /api --include src/api
```

把输出写入临时文件：

```bash
npx api-tracer-ast --file src/api/user.ts --prefix /api --include src/api > /tmp/user.transformed.ts
```

指定多个 API 前缀和多个 include 范围：

```bash
npx api-tracer-ast \
  --file src/pages/home.tsx \
  --prefix /api,/gateway \
  --include src/api,src/pages \
  --defaultName unknown-api
```

指定项目根目录：

```bash
npx api-tracer-ast \
  --file src/api/user.ts \
  --root /path/to/project \
  --prefix /api \
  --include src/api
```

### CLI 参数

- `--file`：必填。要转换的源码文件路径，例如 `src/api/user.ts`。如果文件没有命中 `--include`，会原样输出。
- `--prefix`：必填。需要注入请求头的 URL 前缀，多个值用英文逗号分隔，例如 `/api,/gateway`。该值对应 plugin/loader 里的 `urlPrefixes`。
- `--include`：选填。需要转换的文件或目录，多个值用英文逗号分隔，例如 `src/api,src/pages`。不传时默认只处理 `--file` 指定的文件。
- `--root`：选填。项目根目录，默认当前命令执行目录。`--include` 会基于该目录解析。
- `--defaultName`：选填。请求不在具名函数内时使用的默认接口名称，默认值是 `none-name`。

### 参数对应关系

CLI 参数和 plugin/loader 配置的对应关系如下：

```js
{
  include: '--include',
  urlPrefixes: '--prefix',
  defaultRequestName: '--defaultName'
}
```

CLI 暂不支持传入完整 `clients` 自定义规则、`exclude`、`headerName`、`resolver` 等复杂配置。如果需要这些能力，请使用 `ApiTracerAstPlugin` 或 `api-tracer-ast/loader`。

## 限制

以下情况无法识别、无法注入请求头，或只能注入默认接口名称。

### 文件范围限制

- 文件没有命中 `include` 时不会处理。例如只配置 `include: ['src/api']`，则 `src/pages/home.tsx` 里的 `axios.get(...)` 不会被转换。
- 文件命中 `exclude` 时不会处理，例如 `**/*.test.ts`、`src/mock/**`。
- 构建工具没有让文件经过 plugin/loader 时不会处理，例如某些 monorepo 子包、特殊后缀文件、或内部构建链未覆盖的文件。
- 插件执行时机太晚时可能识别失败。如果代码已经被压缩、混淆或转译成 `a.b('/api')` 这类形态，就无法稳定识别接口名。建议 loader 使用 `enforce: 'pre'`。

### 请求客户端来源限制

- 建议配置 `clients[].from`。不配置时只能按变量名或宽松规则匹配，`include` 范围过宽时可能误判普通 `request.get(...)`。
- 配置了 `clients[].from` 后，只转换从指定来源 import 的客户端；本地声明的 `const request = ...` 不会被转换。
- 如果 `clients[].from` 使用 alias，但 plugin/loader 无法拿到对应 resolver 配置，则不会命中，需要手动补充 `resolver.alias`。
- `clients[].from` 只分析静态 `import`，暂不支持 `require()`、动态 `import()` 或运行时创建的局部实例来源追踪。

### 请求类型限制

- 当前只支持 axios-like 请求：`request.get(url, config)`、`request.post(url, data, config)`、`request({ url })`。
- 暂不支持 `fetch(url, options)`。
- 暂不支持原生 `XMLHttpRequest`，例如 `xhr.open(...)`、`xhr.send(...)`。
- 暂不支持第三方 SDK 内部自己发出的请求，例如 `sdk.track()`、`sdk.request()`，除非 SDK 暴露出来的调用形式本身符合 axios-like 规则且文件命中 `include`。

### 调用形态限制

- 默认只识别 `get`、`delete`、`head`、`options`、`post`、`put`、`patch`。如果项目使用 `request.upload(...)`、`request.download(...)`、`request.send(...)`，需要通过 `clients.methods` 手动配置参数位置。
- 不支持 `request.get(...args)`、`request.post(...args)` 这类 spread 参数，因为无法安全判断哪个参数是 URL、哪个参数是 config。
- 不支持 config 参数本身是 spread 的调用，例如 `request.get('/api/list', ...configs)`。
- 不支持把方法解构出来后再调用，例如 `const get = request.get; get('/api/list')`。
- 不支持动态方法名，例如 `request[method]('/api/list')`。
- 不支持可选链调用，例如 `request?.get('/api/list')`。
- 不支持动态客户端调用，例如 `getRequestClient().get('/api/list')`、`clients[type].get('/api/list')`。

### 对象式调用限制

- 对象式调用默认读取 `url` 字段和 `headers` 字段，例如 `request({ url: '/api/list' })`。
- 如果项目使用其他字段名，例如 `request({ path: '/api/list' })`，需要通过 `clients[].objectCall.urlKey` 配置。
- 不支持对象式调用使用 spread 参数，例如 `request(...args)`。

### 接口名称限制

- 如果请求在具名函数内，例如 `function getList() { return request.get(...) }`，会使用 `getList` 作为接口名称。
- 如果请求不在具名函数内，例如文件顶层直接 `axios.get('/api/list')`，会使用 `defaultRequestName`，默认是 `none-name`。
- 匿名函数或无法稳定推断名称的函数会使用 `defaultRequestName`，例如 `export default () => request.get(...)`、`setTimeout(() => request.get(...))`。
- 复杂二次封装不会反推外层业务函数名。例如 `getList()` 调用 `get('/api/list')`，而 `get()` 内部才调用 `request.get(...)`，当前只能识别到直接包含请求调用的函数，无法追踪回 `getList`。

### URL 前缀限制

- URL 匹配在运行时执行。只有真实 URL 匹配 `urlPrefixes` 时才会注入请求头。
- 不匹配 `urlPrefixes` 的请求不会注入请求头，插件接口名称列显示 `--`，不会显示 `anonymous`。
- URL 参数可以是字符串、变量或表达式，例如 `getUrl()`、`prefix + '/list'`；但如果 URL 来自 spread 或过于动态的调用形态，会受调用形态限制影响。

### 配置范围提醒

- 如果 `include` 配置过宽，可能会转换业务组件里的直接 axios 调用；推荐同时配置 `clients[].from` 避免误判。
- CLI 只适合调试单文件，复杂配置请使用 `ApiTracerAstPlugin` 或 `api-tracer-ast/loader`。
