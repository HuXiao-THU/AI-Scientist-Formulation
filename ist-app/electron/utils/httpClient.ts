import http from 'node:http'
import https from 'node:https'
import { safeErrorMessage } from './truncate'

export interface HttpResponse {
  status: number
  body: string
}

/** Use node:http(s) instead of fetch to avoid Electron/Node TLS + undici crashes. */
export function request(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string
    timeoutMs?: number
  } = {}
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch (err) {
      reject(new Error(safeErrorMessage(err, 200)))
      return
    }

    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.request(
      parsed,
      {
        method: options.method ?? 'GET',
        headers: options.headers
      },
      (res) => {
        const chunks: Buffer[] = []
        let total = 0
        const maxBody = 256 * 1024
        res.on('data', (chunk: Buffer) => {
          total += chunk.length
          if (total <= maxBody) chunks.push(chunk)
        })
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf-8')
          })
        })
      }
    )

    req.setTimeout(options.timeoutMs ?? 120_000, () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.on('error', (err) => {
      reject(new Error(safeErrorMessage(err, 200)))
    })

    if (options.body) req.write(options.body)
    req.end()
  })
}
