import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../..')

const sourceRoots = [
  'apps/web/src',
  'services/api/tangent_api',
  'services/api/scripts',
]

const checks = [
  {
    allow: ['services/api/tangent_api/security_redis.py'],
    name: 'dangerous-dom-sink',
    pattern: /\b(dangerouslySetInnerHTML|innerHTML|outerHTML|document\.write|new Function|eval\s*\()/,
  },
  {
    allow: [
      'apps/web/src/app/api/_lib/apiRequestContext.ts',
      'apps/web/src/features/auth/mockSession.ts',
      'services/api/scripts/s2_live_ai_smoke.py',
      'services/api/scripts/s4_collaboration_presence_smoke.py',
      'services/api/scripts/s4_realtime_multiplayer_load_support.py',
      'services/api/scripts/s4_realtime_resync_smoke.py',
      'services/api/scripts/s4_workspace_invite_smoke.py',
      'services/api/scripts/security_staging_auth_smoke.py',
    ],
    name: 'client-spoofable-workspace-context-header',
    pattern: /x-tangent-(workspace-kind|workspace-name|workspace-role|plan-key)/,
  },
  {
    allow: [],
    name: 'hardcoded-secret-pattern',
    pattern: /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{20,})/,
  },
  {
    allow: [],
    name: 'browser-token-storage',
    pattern: /(localStorage|sessionStorage)\.(setItem|getItem)\([^)]*(token|authorization|bearer|secret)/i,
  },
]

const findings = []
for (const relativeRoot of sourceRoots) {
  const files = await listFiles(path.join(repoRoot, relativeRoot))
  for (const file of files) {
    await inspectFile(file)
  }
}

assert.deepEqual(findings, [])
console.log('security static guard passed')

async function inspectFile(file) {
  const relativePath = slash(path.relative(repoRoot, file))
  if (!isSourceFile(relativePath)) return
  const source = await readFile(file, 'utf8')
  const lines = source.split(/\r?\n/)
  for (const check of checks) {
    if (check.allow.includes(relativePath)) continue
    for (const [index, line] of lines.entries()) {
      if (!check.pattern.test(line)) continue
      findings.push({
        check: check.name,
        line: index + 1,
        path: relativePath,
      })
    }
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === '__pycache__' || entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

function isSourceFile(relativePath) {
  return /\.(mjs|js|jsx|ts|tsx|py)$/.test(relativePath)
}

function slash(value) {
  return value.split(path.sep).join('/')
}
