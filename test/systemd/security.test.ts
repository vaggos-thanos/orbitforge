import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

const deploymentRoot = new URL('../../deploy/systemd/', import.meta.url)
const workerRoot = new URL('../../apps/worker/', import.meta.url)

async function deploymentFile(name: string): Promise<string> {
  return readFile(new URL(name, deploymentRoot), 'utf8')
}

describe('Milestone 1 systemd templates', () => {
  it('isolates the web service and binds it to localhost', async () => {
    const unit = await deploymentFile('orbitforge-web.service')

    expect(unit).toContain('User=orbitforge-web')
    expect(unit).toContain('Group=orbitforge-web')
    expect(unit).toContain('SupplementaryGroups=orbitforge')
    expect(unit).toContain('Environment=NITRO_HOST=127.0.0.1')
    expect(unit).toContain('Environment=ORBITFORGE_WEB_HOST=127.0.0.1')
    expect(unit).toContain('ReadWritePaths=/var/lib/orbitforge/web')
    expect(unit).not.toMatch(/0\.0\.0\.0|::/)
  })

  it('isolates the worker and restricts socket creation to its runtime path', async () => {
    const unit = await deploymentFile('orbitforge-worker.service')

    expect(unit).toContain('User=orbitforge-worker')
    expect(unit).toContain('Group=orbitforge-worker')
    expect(unit).toContain('SupplementaryGroups=orbitforge')
    expect(unit).toContain(
      'Environment=ORBITFORGE_WORKER_SOCKET=/run/orbitforge/worker.sock',
    )
    expect(unit).toContain('ReadWritePaths=/run/orbitforge')
    expect(unit).not.toMatch(/rtl_test|satdump\s+live|blacklist|modprobe/)
  })

  it.each(['orbitforge-web.service', 'orbitforge-worker.service'])(
    'hardens %s without coupling it to SatDump',
    async (name) => {
      const unit = await deploymentFile(name)

      expect(unit).toContain('NoNewPrivileges=true')
      expect(unit).toContain('PrivateTmp=true')
      expect(unit).toContain('ProtectSystem=strict')
      expect(unit).toContain('Restart=on-failure')
      expect(unit).toContain('StartLimitIntervalSec=60s')
      expect(unit).toContain('StartLimitBurst=5')
      expect(unit).toContain('StandardOutput=journal')
      expect(unit).toContain('StandardError=journal')
      expect(unit).not.toMatch(
        /^(?:After|Before|Requires|Requisite|Wants|BindsTo|PartOf|Conflicts)=.*satdump-autotrack\.service/m,
      )
    },
  )

  it('declares separate users and uses the shared group only for the socket', async () => {
    const [sysusers, tmpfiles] = await Promise.all([
      deploymentFile('orbitforge.sysusers'),
      deploymentFile('orbitforge.tmpfiles'),
    ])

    expect(sysusers).toContain('g orbitforge')
    expect(sysusers).toContain('u orbitforge-web')
    expect(sysusers).toContain('u orbitforge-worker')
    expect(sysusers).toContain('m orbitforge-web orbitforge')
    expect(sysusers).toContain('m orbitforge-worker orbitforge')
    expect(tmpfiles).toContain(
      'd /run/orbitforge 0750 orbitforge-worker orbitforge -',
    )
    expect(tmpfiles).toContain(
      'd /var/lib/orbitforge/web 0750 orbitforge-web orbitforge-web -',
    )
    expect(tmpfiles).not.toContain('/home/vaggos/satdump_out')
  })

  it('points at the checked production worker build', async () => {
    const [unit, packageText, main] = await Promise.all([
      deploymentFile('orbitforge-worker.service'),
      readFile(new URL('package.json', workerRoot), 'utf8'),
      readFile(new URL('src/main.ts', workerRoot), 'utf8'),
    ])
    const workerPackage = JSON.parse(packageText) as {
      scripts?: Record<string, string>
    }

    expect(workerPackage.scripts?.build).toContain(
      '--format=cjs --target=node24 --outfile=dist/main.cjs',
    )
    expect(unit).toContain(
      'ExecStart=/usr/local/bin/node /opt/orbitforge/current/apps/worker/dist/main.cjs',
    )
    expect(main).toContain('createWorkerSocketServer')
    expect(main).not.toMatch(/rtl_test|satdump\s+live|blacklist|modprobe/)
  })
})
