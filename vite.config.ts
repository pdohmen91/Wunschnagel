import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { localLinkPreviewPlugin } from './server/link-preview'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), localLinkPreviewPlugin(env.PREVIEW_ALLOWED_HOSTS), {
      name: 'precache-app-shell',
      apply: 'build',
      async closeBundle() {
        const index = await readFile('dist/index.html', 'utf8')
        const worker = await readFile('dist/sw.js', 'utf8')
        const version = createHash('sha256').update(index + worker).digest('hex').slice(0, 12)
        const assets = (await readdir('dist/assets')).filter(file => /\.(js|css)$/.test(file)).map(file => `assets/${file}`)
        await writeFile('dist/sw.js', worker.replace('shell-v1', `shell-${version}`).replace('const BUILD_ASSETS = []', `const BUILD_ASSETS = ${JSON.stringify(assets)}`))
      },
    }],
    base: env.VITE_BASE_PATH || '/',
  }
})
