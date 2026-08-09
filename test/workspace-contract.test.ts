import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

type PackageManifest = {
  name?: string
  scripts?: Record<string, string>
}

async function workspaceManifests(): Promise<PackageManifest[]> {
  const manifests: PackageManifest[] = []

  for (const workspaceRoot of ['apps', 'packages']) {
    const entries = await readdir(workspaceRoot, { withFileTypes: true }).catch(
      () => [],
    )

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const manifestPath = join(workspaceRoot, entry.name, 'package.json')
      const manifest = JSON.parse(
        await readFile(manifestPath, 'utf8'),
      ) as PackageManifest
      manifests.push(manifest)
    }
  }

  return manifests
}

describe('pnpm workspace contract', () => {
  it('gives every workspace a unique scoped name and typecheck command', async () => {
    const manifests = await workspaceManifests()
    const names = manifests.map(({ name }) => name)

    expect(manifests.length).toBeGreaterThan(0)
    expect(names.every((name) => name?.startsWith('@orbitforge/'))).toBe(true)
    expect(new Set(names).size).toBe(names.length)
    expect(
      manifests.every(({ scripts }) => typeof scripts?.typecheck === 'string'),
    ).toBe(true)
  })
})
