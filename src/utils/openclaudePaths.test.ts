import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import * as fsPromises from 'fs/promises'
import { homedir, tmpdir } from 'os'
import { join } from 'path'

const originalEnv = { ...process.env }
const originalArgv = [...process.argv]

async function importFreshEnvUtils() {
  return import(`./envUtils.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshSettings() {
  return import(`./settings/settings.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshLocalInstaller() {
  return import(`./localInstaller.ts?ts=${Date.now()}-${Math.random()}`)
}

async function importFreshPlans() {
  return import(`./plans.ts?ts=${Date.now()}-${Math.random()}`)
}

afterEach(() => {
  process.env = { ...originalEnv }
  process.argv = [...originalArgv]
  mock.restore()
})

describe('OmixCode paths', () => {
  test('defaults user config home to ~/.OmixCode', async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    const { resolveClaudeConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveClaudeConfigHomeDir({
        homeDir: homedir(),
      }),
    ).toBe(join(homedir(), '.OmixCode'))
  })

  test('hard-cuts user config home to ~/.OmixCode by default', async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    const { resolveClaudeConfigHomeDir } = await importFreshEnvUtils()

    expect(
      resolveClaudeConfigHomeDir({
        homeDir: homedir(),
      }),
    ).toBe(join(homedir(), '.OmixCode'))
  })

  test('migrates legacy config home and global config files to .OmixCode', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'OmixCode-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.claude', 'skills', 'legacy-skill'), {
        recursive: true,
      })
      writeFileSync(
        join(tempHome, '.claude', 'skills', 'legacy-skill', 'SKILL.md'),
        'legacy skill',
      )
      writeFileSync(join(tempHome, '.claude', 'settings.json'), '{}')
      writeFileSync(join(tempHome, '.claude.json'), '{"legacy":true}')
      writeFileSync(
        join(tempHome, '.claude-custom-oauth.json'),
        '{"custom":true}',
      )

      const { migrateLegacyClaudeConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyClaudeConfigHome({ homeDir: tempHome })).toBe(true)
      expect(
        readFileSync(
          join(tempHome, '.OmixCode', 'skills', 'legacy-skill', 'SKILL.md'),
          'utf8',
        ),
      ).toBe('legacy skill')
      expect(existsSync(join(tempHome, '.OmixCode', 'settings.json'))).toBe(
        true,
      )
      expect(readFileSync(join(tempHome, '.OmixCode.json'), 'utf8')).toBe(
        '{"legacy":true}',
      )
      expect(
        readFileSync(join(tempHome, '.OmixCode-custom-oauth.json'), 'utf8'),
      ).toBe('{"custom":true}')
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration preserves existing .OmixCode data while copying missing legacy data', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'OmixCode-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.claude', 'skills', 'legacy-skill'), {
        recursive: true,
      })
      mkdirSync(join(tempHome, '.OmixCode', 'skills'), { recursive: true })
      writeFileSync(join(tempHome, '.claude', 'settings.json'), 'legacy')
      writeFileSync(join(tempHome, '.OmixCode', 'settings.json'), 'current')
      writeFileSync(
        join(tempHome, '.claude', 'skills', 'legacy-skill', 'SKILL.md'),
        'legacy skill',
      )

      const { migrateLegacyClaudeConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyClaudeConfigHome({ homeDir: tempHome })).toBe(true)
      expect(
        readFileSync(join(tempHome, '.OmixCode', 'settings.json'), 'utf8'),
      ).toBe('current')
      expect(
        readFileSync(
          join(tempHome, '.OmixCode', 'skills', 'legacy-skill', 'SKILL.md'),
          'utf8',
        ),
      ).toBe('legacy skill')
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration skips explicit CLAUDE_CONFIG_DIR overrides', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'OmixCode-paths-test-'))
    try {
      mkdirSync(join(tempHome, '.claude'), { recursive: true })
      writeFileSync(join(tempHome, '.claude', 'settings.json'), 'legacy')

      const { migrateLegacyClaudeConfigHome } = await importFreshEnvUtils()

      expect(
        migrateLegacyClaudeConfigHome({
          configDirEnv: join(tempHome, 'custom-config'),
          homeDir: tempHome,
        }),
      ).toBe(true)
      expect(existsSync(join(tempHome, '.OmixCode'))).toBe(false)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration fails closed when .OmixCode collides with a non-directory', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'OmixCode-paths-test-'))
    try {
      writeFileSync(join(tempHome, '.OmixCode'), 'not a directory')
      mkdirSync(join(tempHome, '.claude'), { recursive: true })
      writeFileSync(join(tempHome, '.claude', 'settings.json'), 'legacy')

      const { migrateLegacyClaudeConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyClaudeConfigHome({ homeDir: tempHome })).toBe(false)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('migration ignores non-directory legacy config homes', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'OmixCode-paths-test-'))
    try {
      writeFileSync(join(tempHome, '.claude'), 'not a directory')

      const { migrateLegacyClaudeConfigHome } = await importFreshEnvUtils()

      expect(migrateLegacyClaudeConfigHome({ homeDir: tempHome })).toBe(true)
      expect(existsSync(join(tempHome, '.OmixCode'))).toBe(false)
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('config home falls back to legacy when migration fails on a non-directory .OmixCode collision', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'OmixCode-paths-test-'))
    try {
      writeFileSync(join(tempHome, '.OmixCode'), 'not a directory')
      mkdirSync(join(tempHome, '.claude'), { recursive: true })
      mock.module('os', () => ({
        homedir: () => tempHome,
        tmpdir,
      }))
      delete process.env.CLAUDE_CONFIG_DIR

      const { getClaudeConfigHomeDir } = await importFreshEnvUtils()

      expect(getClaudeConfigHomeDir()).toBe(join(tempHome, '.claude'))
    } finally {
      rmSync(tempHome, { recursive: true, force: true })
    }
  })

  test('default plans directory uses ~/.OmixCode/plans', async () => {
    delete process.env.CLAUDE_CONFIG_DIR
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(getDefaultPlansDirectory({ homeDir: homedir() })).toBe(
      join(homedir(), '.OmixCode', 'plans'),
    )
  })

  test('default plans directory respects explicit CLAUDE_CONFIG_DIR', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/custom-OmixCode' }),
    ).toBe(join('/tmp/custom-OmixCode', 'plans'))
  })

  test('default plans directory normalizes generated path to NFC', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ homeDir: '/tmp/cafe\u0301' }),
    ).toBe(join('/tmp/caf\u00e9', '.OmixCode', 'plans'))
  })

  test('default plans directory normalizes explicit CLAUDE_CONFIG_DIR to NFC', async () => {
    const { getDefaultPlansDirectory } = await importFreshPlans()

    expect(
      getDefaultPlansDirectory({ configDirEnv: '/tmp/cafe\u0301-OmixCode' }),
    ).toBe(join('/tmp/caf\u00e9-OmixCode', 'plans'))
  })

  test('uses CLAUDE_CONFIG_DIR override when provided', async () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/custom-OmixCode'
    const { getClaudeConfigHomeDir, resolveClaudeConfigHomeDir } =
      await importFreshEnvUtils()

    expect(getClaudeConfigHomeDir()).toBe('/tmp/custom-OmixCode')
    expect(
      resolveClaudeConfigHomeDir({
        configDirEnv: '/tmp/custom-OmixCode',
      }),
    ).toBe('/tmp/custom-OmixCode')
  })

  test('project and local settings paths use .OmixCode', async () => {
    const { getRelativeSettingsFilePathForSource } = await importFreshSettings()

    expect(getRelativeSettingsFilePathForSource('projectSettings')).toBe(
      '.OmixCode/settings.json',
    )
    expect(getRelativeSettingsFilePathForSource('localSettings')).toBe(
      '.OmixCode/settings.local.json',
    )
  })

  test('local installer uses OmixCode wrapper path', async () => {
    // Force .OmixCode config home so the test doesn't fall back to
    // ~/.claude when ~/.OmixCode doesn't exist on this machine.
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.OmixCode')
    const { getLocalClaudePath } = await importFreshLocalInstaller()

    expect(getLocalClaudePath()).toBe(
      join(homedir(), '.OmixCode', 'local', 'OmixCode'),
    )
  })

  test('local installation detection matches .OmixCode path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.OmixCode', 'local')}/node_modules/.bin/OmixCode`,
      ),
    ).toBe(true)
  })

  test('local installation detection still matches legacy .claude path', async () => {
    const { isManagedLocalInstallationPath } =
      await importFreshLocalInstaller()

    expect(
      isManagedLocalInstallationPath(
        `${join(homedir(), '.claude', 'local')}/node_modules/.bin/OmixCode`,
      ),
    ).toBe(true)
  })

  test('candidate local install dirs include both OmixCode and legacy claude paths', async () => {
    const { getCandidateLocalInstallDirs } = await importFreshLocalInstaller()

    expect(
      getCandidateLocalInstallDirs({
        configHomeDir: join(homedir(), '.OmixCode'),
        homeDir: homedir(),
      }),
    ).toEqual([
      join(homedir(), '.OmixCode', 'local'),
      join(homedir(), '.claude', 'local'),
    ])
  })

  test('legacy local installs are detected when they still expose the claude binary', async () => {
    mock.module('fs/promises', () => ({
      ...fsPromises,
      access: async (path: string) => {
        if (
          path === join(homedir(), '.claude', 'local', 'node_modules', '.bin', 'claude')
        ) {
          return
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      },
    }))

    const { getDetectedLocalInstallDir, localInstallationExists } =
      await importFreshLocalInstaller()

    expect(await localInstallationExists()).toBe(true)
    expect(await getDetectedLocalInstallDir()).toBe(
      join(homedir(), '.claude', 'local'),
    )
  })
})
