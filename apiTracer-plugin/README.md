# ApiTracer 浏览器插件



<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/ApiTracer-README-2f80ed" alt="ApiTracer README" /></a>
  <a href="../apiTracer-ast"><img src="https://img.shields.io/badge/api--tracer--ast-目录-2f80ed" alt="api-tracer-ast 目录" /></a>
  <a href="https://www.npmjs.com/package/api-tracer-ast?activeTab=readme"><img src="https://img.shields.io/badge/npm-package-cb3837" alt="npm package" /></a>
</p>

## 介绍

ApiTracer 浏览器插件是 ApiTracer 产品的 DevTools 面板部分，用于在浏览器开发者工具中以业务接口函数名维度查看前端接口请求。插件配合 [`api-tracer-ast`](../apiTracer-ast) 使用：npm 包在构建期为 axios-like 请求注入 `X-Request-Name` 请求头，并通过 `window.postMessage` 向插件同步 API 前缀；插件在 DevTools 面板中读取网络请求、展示接口名称，并根据用户配置的业务成功判断函数标记请求结果。

主要能力：

- 在 DevTools 中新增 `ApiTracer` 面板。
- 展示接口名称、请求方法、业务成功状态、HTTP 状态和 URL 路径。
- 支持按接口名称 / URL 搜索。
- 支持按全部、成功、失败、API 前缀、有接口名称进行筛选。
- 支持配置多个业务成功判断函数，并选择其中一个启用。
- 支持查看请求头、查询参数、请求体、响应头、响应体和 Preview。
- 支持未读请求高亮、已读标记、清空列表、刷新页面与请求。
- 在业务成功判断函数配置面板展示当前 npm 包下发的 API 前缀。

### 浏览器兼容性

- Chrome ≥ 102，Manifest V3。
- Microsoft Edge ≥ 102，Manifest V3，加载方式与 Chrome 基本一致。
- Brave、Arc、Opera 等 Chromium 系浏览器通常也可以使用。
- Firefox 暂不支持，当前实现依赖 Chrome DevTools Extension API。

## 项目架构和目录结构

### 通信链路

```txt
业务页面
  │
  │ window.postMessage({ source: 'api-tracer', type: 'config', payload: { apiPrefixes } })
  ▼
content script
  │
  │ chrome.runtime.sendMessage
  ▼
background service worker
  │
  │ chrome.runtime.Port(api-tracer-panel)
  ▼
DevTools Panel
  │
  │ chrome.devtools.network.onRequestFinished
  ▼
请求列表 / 请求详情 / 业务成功判断
```

说明：

- 请求列表中的接口名称来自请求头 `X-Request-Name`。
- API 前缀用于判断哪些请求需要执行业务成功判断；不匹配前缀的请求业务成功状态显示 `--`。

### 目录结构

```txt
apiTracer-plugin/
├── assets/                      演示截图资源
│   ├── home.png
│   ├── filter.png
│   ├── preview.png
│   └── setting.png
├── scripts/
│   └── copy-static.mjs          构建后复制静态资源到 dist
├── src/
│   ├── shared/
│   │   └── protocol.ts          页面、content、background、panel 之间的通信协议
│   ├── content/
│   │   └── content.ts           监听页面 postMessage 并转发给 background
│   ├── background/
│   │   └── background.ts        维护 tabId 与 DevTools panel port 的映射并转发消息
│   ├── devtools/
│   │   └── devtools.ts          注册 ApiTracer DevTools 面板
│   ├── panel/
│   │   ├── panel.ts             面板入口，挂载各组件并启动网络桥接
│   │   ├── network-bridge.ts    接收页面配置，监听 DevTools network 请求
│   │   ├── network.ts           HAR entry 转换为插件内部 RequestRecord
│   │   ├── api-prefix.ts        API 前缀匹配逻辑
│   │   ├── evaluator.ts         根据 API 前缀和业务函数计算成功/失败
│   │   ├── success-fn.ts        编译和执行用户配置的业务成功判断函数
│   │   ├── storage.ts           chrome.storage.local 持久化封装
│   │   ├── store.ts             面板状态和事件总线
│   │   └── components/          顶栏、列表、详情、配置弹窗等 UI 组件
│   ├── sandbox/
│   │   └── sandbox.ts           沙箱页面脚本
│   └── static/
│       ├── manifest.json        浏览器插件 Manifest V3 配置
│       ├── panel/               DevTools 面板 HTML 和 CSS
│       ├── devtools/            DevTools 页面 HTML
│       ├── sandbox/             沙箱页面 HTML
│       └── icons/               插件图标
├── api-tracer-plugin.zip        dist 压缩包，解压后可直接加载到浏览器
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## 安装方式

### 从浏览器市场安装

插件发布到浏览器市场后，可在对应浏览器扩展市场搜索 `ApiTracer` 并安装。安装后打开任意页面的 DevTools，即可看到 `ApiTracer` 面板。

### 开发模式安装

1. 安装依赖并构建插件：

```bash
cd apiTracer-plugin
npm install
npm run build
```

或者直接解压 `api-tracer-plugin.zip`。

2. 加载构建产物：

Chrome：

1. 打开 `chrome://extensions/`
2. 开启右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择 `apiTracer-plugin/dist` 目录

Edge：

1. 打开 `edge://extensions/`
2. 开启左下角“开发人员模式”
3. 点击“加载解压缩的扩展”
4. 选择 `apiTracer-plugin/dist` 目录

### 配合 npm 包使用

插件需要配合 `api-tracer-ast` 才能显示业务接口名称。业务项目中需要在开发环境启用构建插件：

```js
const { ApiTracerAstPlugin } = require('api-tracer-ast/plugin')

const isDev = process.env.NODE_ENV !== 'production'

module.exports = {
  plugins: [
    ...(isDev
      ? [
          new ApiTracerAstPlugin({
            include: ['src/api', 'src/pages'],
            urlPrefixes: ['/api'],
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

接入后：

1. 启动业务项目。
2. 打开 DevTools 并切换到 `ApiTracer` 面板。
3. 触发接口请求。
4. 若请求命中 `urlPrefixes`，且构建期成功注入 `X-Request-Name`，插件会展示接口名称。
5. 点击右上角“配置”，可新增或编辑业务成功判断函数，例如 `res => res.code === 0`。

## 开源协议

MIT License。详见 [LICENSE](./LICENSE)。
