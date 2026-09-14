import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const port = Number(process.argv[2] ?? 5500)
const root = resolve(process.cwd(), '..', 'widget')
const apiBaseUrl = process.env.BUGSHOT_API_URL ?? 'http://localhost:8085'
const configPath = join(root, 'config.js')

await fs.writeFile(
  configPath,
  `window.BUGSHOT_CONFIG = { apiBaseUrl: ${JSON.stringify(apiBaseUrl)} };`,
  'utf8',
)

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    const pathname = decodeURIComponent(requestUrl.pathname)
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const filePath = resolve(root, normalize(relativePath))

    if (!filePath.startsWith(root)) {
      response.writeHead(403)
      response.end('Forbidden')
      return
    }

    const content = await fs.readFile(filePath)
    response.writeHead(200, {
      'Content-Type':
        contentTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    response.end(content)
  } catch (error) {
    const code = error?.code === 'ENOENT' ? 404 : 500
    response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(code === 404 ? 'Not Found' : 'Internal Server Error')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Widget server listening on http://127.0.0.1:${port}`)
})

process.on('SIGINT', () => server.close(() => process.exit(0)))
process.on('SIGTERM', () => server.close(() => process.exit(0)))
