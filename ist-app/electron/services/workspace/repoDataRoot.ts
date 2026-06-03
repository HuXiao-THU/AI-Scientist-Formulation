import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

function candidates(): string[] {
  const roots = new Set<string>()
  roots.add(process.cwd())
  roots.add(join(process.cwd(), '..'))
  roots.add(join(process.cwd(), '../..'))
  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    roots.add(dir)
    dir = dirname(dir)
  }
  return [...roots]
}

export function findRepoDataRoot(): string | null {
  for (const root of candidates()) {
    if (existsSync(join(root, 'data', 'cal_housing.csv'))) {
      return root
    }
  }
  return null
}
