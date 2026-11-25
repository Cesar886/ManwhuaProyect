import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const productionSiteUrl = 'https://manhwaimperial.site'
const configuredSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '')
const isLocalSiteUrl = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(configuredSiteUrl)
const resolvedSiteUrl = isLocalSiteUrl || !configuredSiteUrl
  ? productionSiteUrl
  : configuredSiteUrl

if (resolvedSiteUrl !== productionSiteUrl) {
  console.error(`SITE_URL no resuelto a produccion: ${resolvedSiteUrl}`)
  process.exit(1)
}

async function findForbiddenFiles(directory) {
  const matches = []

  async function walk(currentDirectory) {
    let entries
    try {
      entries = await readdir(currentDirectory, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name)
      if (entry.name === '.env' || entry.name.startsWith('.env.')) continue
      if (entry.isDirectory()) {
        if (!entryPath.split(path.sep).includes('cache') && entry.name !== 'node_modules') {
          await walk(entryPath)
        }
      } else if (!entry.name.endsWith('.map') && entry.name !== 'manifest.json') {
        if (/\.(?:html|rsc|js|json|txt|body|xml|xml\.txt)$/.test(entry.name)) {
          matches.push(entryPath)
        }
      }
    }
  }

  await walk(directory)
  return matches
}

const roots = ['.next/server/app', '.next/standalone']
const forbidden = []

for (const root of roots) {
  for (const file of await findForbiddenFiles(root)) {
    const content = await readFile(file)
    // El SSR puede contener la API privada local en :3000; eso es intencional.
    // Solo bloqueamos URLs del frontend/dev server o localhost usado como sitio público.
    if (/https?:\/\/127\.0\.0\.1:(?!3000)\d+|["'`]127\.0\.0\.1:(?!3000)\d+/i.test(content.toString('utf8'))) {
      forbidden.push(file)
    }
  }
}

if (forbidden.length > 0) {
  console.error('Se encontraron URLs locales en el build:')
  for (const file of forbidden) console.error(`- ${file}`)
  process.exit(1)
}

console.log(`SITE_URL verificado: ${resolvedSiteUrl}`)
