import { defineConfig } from 'tsup'

/**
 * 4 个入口分别打包为独立的 IIFE/ESM 文件，
 * Chrome/Edge MV3 service worker 与 content script 均支持 ESM。
 */
export default defineConfig({
  entry: {
    'content/content': 'src/content/content.ts',
    'background/background': 'src/background/background.ts',
    'devtools/devtools': 'src/devtools/devtools.ts',
    'panel/panel': 'src/panel/panel.ts',
    'sandbox/sandbox': 'src/sandbox/sandbox.ts',
  },
  format: ['esm'],
  outDir: 'dist',
  splitting: false,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  dts: false,
  treeshake: true,
})
