import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(scriptDir, '..')
const helperPath = path.join(webRoot, 'src/app/api/boards/_lib/localBoardSharePassword.ts')

function normalizeBoardShareId(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^[a-zA-Z0-9_-]{8,64}$/.test(trimmed) ? trimmed : null
}

async function loadSharePasswordHelper() {
  const source = await readFile(helperPath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: helperPath,
  })
  const cjsModule = { exports: {} }
  const sandbox = {
    Buffer,
    exports: cjsModule.exports,
    module: cjsModule,
    require(specifier) {
      if (specifier === 'node:buffer') return { Buffer }
      if (specifier === 'node:crypto') return awaitlessCrypto
      if (specifier === '@/features/boards/boardTypes') return { normalizeBoardShareId }
      throw new Error(`Unexpected import in smoke: ${specifier}`)
    },
  }
  vm.runInNewContext(outputText, sandbox, { filename: helperPath })
  return cjsModule.exports
}

const awaitlessCrypto = await import('node:crypto')
const helper = await loadSharePasswordHelper()

const baseEntry = {
  accessRole: 'viewer',
  boardId: 'board_share_smoke',
  createdAt: '2026-05-20T00:00:00.000Z',
  createdBy: 'user_share_smoke',
  expiresAt: null,
  id: 'board_share_entry_smoke',
  passwordProtected: false,
  shareId: 'ShareToken_123',
  workspaceId: 'workspace_share_smoke',
}

const normalized = helper.normalizeLocalBoardShareLinkEntry({
  ...baseEntry,
  passwordHash: '',
  revokedAt: '',
  shareId: '  ShareToken_123  ',
})
assert.equal(normalized.shareId, 'ShareToken_123')
assert.equal(normalized.passwordHash, null)
assert.equal(normalized.passwordProtected, false)
assert.equal(normalized.revokedAt, null)
assert.equal(helper.normalizeLocalBoardShareLinkEntry({ ...baseEntry, shareId: '../bad-token' }), null)
assert.equal(helper.normalizeLocalBoardShareLinkEntry({ ...baseEntry, accessRole: 'owner' }), null)

helper.assertLocalBoardSharePassword(normalized)
helper.setLocalBoardSharePassword(normalized, 'correct horse battery staple')
assert.equal(normalized.passwordProtected, true)
assert.match(normalized.passwordHash, /^pbkdf2_sha256\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/)
assert(!normalized.passwordHash.includes('correct horse battery staple'))

assert.throws(
  () => helper.assertLocalBoardSharePassword(normalized),
  helper.LocalBoardSharePasswordError,
)
assert.throws(
  () => helper.assertLocalBoardSharePassword(normalized, 'wrong password'),
  helper.LocalBoardSharePasswordError,
)
helper.assertLocalBoardSharePassword(normalized, 'correct horse battery staple')
assert.equal(helper.getLocalBoardShareErrorStatus(new helper.LocalBoardSharePasswordError(), 400), 401)

const record = helper.localBoardShareEntryToRecord(normalized)
assert.equal(record.passwordProtected, true)
assert(!('passwordHash' in record))

helper.setLocalBoardSharePassword(normalized, null, true)
assert.equal(normalized.passwordHash, null)
assert.equal(normalized.passwordProtected, false)
helper.assertLocalBoardSharePassword(normalized)

console.log('local share password smoke passed')
