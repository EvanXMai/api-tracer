/**
 * DevTools 入口：注册 ApiTracer 面板。
 */

chrome.devtools.panels.create(
  'ApiTracer',
  '',
  'panel/panel.html',
  () => {
    /* panel 创建完成 */
  },
)
