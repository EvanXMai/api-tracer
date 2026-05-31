import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts', 'src/cli.ts', 'src/plugin.ts', 'src/loader.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2020',
  treeshake: true,
  splitting: false,
})
