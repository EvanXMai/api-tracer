# ApiTracer PRD

**前端请求语义化追踪工具 · 产品需求文档 v1.0**

| 项目 | 内容 |
|------|------|
| 产品名称 | ApiTracer |
| 文档版本 | v1.0 |
| 更新日期 | 2026年5月 |
| 产品形态 | 浏览器 DevTools 插件 + 构建期 npm 包 |
| 目标用户 | 前后端分离项目中的前端开发者 |
| 开源协议 | MIT |


## 一、产品介绍

ApiTracer 是一个面向前端开发调试场景的接口语义化追踪工具。它通过浏览器 DevTools 插件和构建期 npm 包协同工作，把浏览器 Network 中难以理解的 URL 请求，转换成前端开发者更熟悉的“业务接口函数名”视角。

在接入 ApiTracer 后，开发者可以在独立的 DevTools 面板中查看：

- 接口名称，例如 `getUserList`、`checkFullControl`。
- 请求方法，例如 `GET`、`POST`、`PUT`、`DELETE`。
- HTTP 状态码。
- 业务成功状态，例如 `✓`、`✗`、`--`。
- URL 路径。
- Request、Response、Preview 等请求详情。

ApiTracer 的核心价值不是替代浏览器原生 Network 面板，而是在 Network 面板之上补充“业务语义层”。它帮助开发者快速回答三个问题：

1. 当前页面触发了哪些业务接口？
2. 某个请求来自哪个接口函数？
3. HTTP 成功但业务失败的请求有哪些？

产品由两个核心部分组成：

- **ApiTracer 浏览器插件**：提供 DevTools 面板，负责展示请求列表、请求详情、业务成功判断和筛选能力。
- **api-tracer-ast npm 包**：在业务项目构建阶段自动为 axios-like 请求注入接口名称请求头，并把 API 前缀同步给浏览器插件。

ApiTracer 推荐仅在开发环境启用。生产环境不启用时，不会注入请求头、不会向插件发送配置，也不会影响线上构建产物。


## 二、产品背景

### 2.1 为什么做

在前后端分离项目中，前端开发者经常需要通过浏览器 DevTools 的 Network 面板确认接口调用是否符合预期。但原生 Network 面板只从网络层展示请求，例如 URL、HTTP 状态码、耗时、响应体等信息，缺少业务代码语义。

典型问题包括：

- Network 列表只展示路径片段，无法直接看出请求对应哪个接口函数。
- 页面一次操作可能触发多个请求，开发者需要逐条展开查看 URL 和响应体。
- HTTP 状态码大多是 200，但业务可能通过 `code`、`success`、`errno` 等字段表达失败。
- 动态 URL、统一 request 实例、接口目录封装会让“请求”和“源码函数”之间的映射更加不直观。
- 调试过程需要在源码、Network、接口文档之间来回切换，效率低且容易漏看。

ApiTracer 由此产生：它将前端源码中的接口函数名带到浏览器 DevTools 面板中，让开发者用业务语言理解网络请求。

### 2.2 做了有什么价值

ApiTracer 带来的价值主要体现在调试效率和问题定位准确性上：

- **降低定位成本**：开发者无需只靠 URL 猜测请求含义，可以直接看到业务接口名称。
- **提升业务判断效率**：通过自定义业务成功判断函数，快速识别 HTTP 200 但业务失败的请求。
- **减少源码侵入**：构建期 AST 注入不会直接修改业务源码文件，也不会在工作区产生源码 diff。
- **控制追踪范围**：通过 API 前缀限制追踪范围，避免对第三方 SDK、监控请求、静态资源请求产生干扰。
- **适配动态 URL**：URL 可以是变量、模板字符串或表达式，运行时再根据真实 URL 判断是否注入请求头。
- **降低误判风险**：通过 `clients[].from` 校验请求客户端来源，避免把普通工具函数误判为请求实例。
- **本地隐私安全**：请求数据只在本地 DevTools 面板中读取和展示，不上传到任何远端服务。

### 2.3 面向群体

ApiTracer 面向以下用户：

- 使用 React、Vue 等 SPA 技术栈的前端工程师。
- 前后端分离项目中需要频繁调试接口的开发者。
- 项目中 API 数量较多、URL 语义不直观的团队。
- 需要快速判断接口业务成功/失败，而不仅仅关注 HTTP 状态码的开发者。
- 希望以较低接入成本增强本地调试体验的工程团队。


## 三、设计架构

### 3.1 产品由哪些部分组成

ApiTracer 由三层组成：

1. **业务项目构建层**
   - 由 `api-tracer-ast` npm 包提供。
   - 通过 plugin 或 loader 接入构建工具。
   - 在构建阶段扫描命中 `include` 的源码文件，识别 axios-like 请求调用。
   - 在构建产物中注入运行时辅助函数，不直接改动源码文件。

2. **业务页面运行层**
   - 构建产物运行在业务页面中。
   - 请求发起时，运行时辅助函数根据真实 URL 和 `urlPrefixes` 判断是否注入 `X-Request-Name`。
   - 页面启动时，通过 `window.postMessage` 向插件发送 API 前缀配置。

3. **浏览器 DevTools 插件层**
   - 由 `apiTracer-plugin` 提供。
   - content script 接收页面 postMessage，并转发给 background。
   - background 根据 tabId 把配置消息转发给当前 DevTools panel。
   - panel 使用 `chrome.devtools.network.onRequestFinished` 读取网络请求及请求头。
   - panel 将请求转换为内部记录，渲染列表和详情，并执行业务成功判断。

### 3.2 各部分如何协同

整体链路如下：

```txt
业务源码
  │
  │ 构建期 AST 转换
  ▼
构建产物中的请求调用
  │
  │ 运行时判断 URL 前缀，注入 X-Request-Name
  ▼
浏览器真实网络请求
  │
  │ chrome.devtools.network.onRequestFinished
  ▼
ApiTracer DevTools Panel
  │
  │ 读取 X-Request-Name，匹配 API 前缀，执行业务成功判断
  ▼
语义化请求列表 / 请求详情 / Preview
```

API 前缀配置同步链路如下：

```txt
api-tracer-ast runtime
  │ window.postMessage({ source: 'api-tracer', type: 'config', payload: { apiPrefixes } })
  ▼
content script
  │ chrome.runtime.sendMessage
  ▼
background service worker
  │ chrome.runtime.Port(api-tracer-panel)
  ▼
DevTools Panel
```

插件和 npm 包之间的协议保持精简：

```ts
{
  source: 'api-tracer',
  type: 'config',
  payload: {
    apiPrefixes: string[]
  }
}
```

插件不依赖 npm 包版本号，也不需要接收包名。包名和版本号只用于业务页面控制台启动日志。

### 3.3 怎么使用

开发者使用 ApiTracer 需要完成两件事：

1. 在业务项目中安装并配置 `api-tracer-ast`。
2. 在浏览器中安装 ApiTracer 插件。

典型接入方式：

```js
const { ApiTracerAstPlugin } = require('api-tracer-ast/plugin')

const isDev = process.env.NODE_ENV !== 'production'

module.exports = {
  resolve: {
    alias: {
      '@': 'src',
      '@api': 'src/api'
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  plugins: [
    ...(isDev
      ? [
          new ApiTracerAstPlugin({
            include: ['src/api', 'src/pages'],
            exclude: ['**/*.test.ts', '**/*.spec.ts'],
            urlPrefixes: ['/api', '/gateway'],
            clients: [
              {
                name: 'request',
                from: ['@api/request', 'src/request']
              },
              {
                name: 'axios',
                from: 'axios'
              }
            ]
          })
        ]
      : [])
  ]
}
```

使用流程：

1. 启动业务项目开发环境。
2. 打开浏览器 DevTools。
3. 切换到 `ApiTracer` 面板。
4. 触发页面请求。
5. 在列表中查看接口名称、请求方法、业务成功状态、HTTP 状态和路径。
6. 点击请求行查看 Request、Response、Preview。
7. 在配置弹窗中设置业务成功判断函数，例如 `res => res.code === 0`。

### 3.4 各部分为什么这样设计

#### 构建期注入而不是直接改源码

ApiTracer 选择构建期 AST 转换，是为了让业务仓库保持源码零侵入。npm 包不会改写用户工作区文件，也不会产生源码 diff。所有注入只存在于开发构建产物中，便于开启、关闭和回滚。

#### 使用请求头承载接口名称

浏览器 DevTools 插件可以稳定读取网络请求头。把接口名称放入 `X-Request-Name`，可以让插件在不理解业务代码、不依赖 source map 的情况下，从网络层拿到业务语义。

#### 运行时判断 URL 前缀

很多项目的 URL 是动态生成的，例如模板字符串、变量拼接或函数返回值。构建期无法可靠判断最终 URL 是否属于业务 API，因此 ApiTracer 在运行时根据真实 URL 和 `urlPrefixes` 判断是否注入请求头。

#### 使用 `clients[].from` 校验请求实例来源

仅按变量名识别 `request.get(...)` 容易误判普通工具函数。`clients[].from` 通过 import 来源判断请求客户端是否来自指定模块，可以把追踪范围限制在真实 axios-like 实例上。

#### API 前缀同时用于注入和业务判断

API 前缀既决定 npm 包是否注入接口名称，也决定插件是否执行业务成功判断。这样可以避免对第三方 SDK、监控请求、静态资源请求执行错误判断。

#### 业务成功判断在插件侧配置

业务成功标准在不同项目中差异很大，例如 `res.code === 0`、`res.success === true`、`res.errno === 0`。插件侧允许用户配置判断函数，可以在不重新构建业务项目的情况下调整判断逻辑。

#### 使用沙箱执行用户函数

Chrome MV3 对 `eval` 和 `new Function` 有 CSP 限制。ApiTracer 使用 sandbox 页面执行用户配置的业务成功判断函数，既满足插件安全约束，也保留灵活的表达式配置能力。

### 3.5 核心原理

ApiTracer 的核心原理可以概括为：构建期识别请求调用，运行时按真实 URL 注入接口名称，插件侧从网络层读取并展示。

1. `api-tracer-ast` 解析源码 AST，识别 `request.get(url, config)`、`request.post(url, data, config)`、`request({ url })` 等 axios-like 调用。
2. 转换器根据最近的具名函数推断接口名称，例如 `getList`。
3. 转换器把原请求 config 包装为运行时辅助函数调用。
4. 运行时辅助函数读取真实 URL，命中 `urlPrefixes` 时合并请求头 `X-Request-Name`。
5. 浏览器发出真实请求。
6. DevTools panel 通过 `chrome.devtools.network.onRequestFinished` 获取 HAR entry。
7. 插件从请求头中读取 `X-Request-Name`，作为列表中的接口名称；没有该请求头时显示 `--`。
8. 插件根据 API 前缀和用户配置的业务成功判断函数计算业务结果。
9. 用户点击列表行后，插件展示请求和响应详情。
