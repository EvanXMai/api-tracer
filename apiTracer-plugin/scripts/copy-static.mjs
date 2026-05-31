/**
 * Copy static assets (manifest.json, HTML, CSS, icons) from src/static to dist/.
 */
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = resolve(root, 'src/static')
const dist = resolve(root, 'dist')

if (!existsSync(dist)) mkdirSync(dist, { recursive: true })
cpSync(src, dist, { recursive: true })

console.log('[copy-static] copied', src, '→', dist)
