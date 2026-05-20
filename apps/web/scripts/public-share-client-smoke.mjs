import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(scriptDir, '..')

const calls = []
let remoteMode = false
const smokeFetch = async (url, init = {}) => {
  calls.push({
    body: init.body,
    headers: normalizeHeaders(init.headers),
    method: init.method ?? 'GET',
    url: String(url),
  })
  return responseFor(url)
}
const shareClient = await loadTsModule('src/features/boards/localBoardShareClient.ts', {
  './localBoardClientShared': {
    getBoardApiUrl(remotePath, localPath) {
      return remoteMode ? `https://api.example.test${remotePath}` : localPath
    },
    getBoardAuthHeaders: async () => ({ Authorization: 'Bearer server-token' }),
    getBoardJsonHeaders: async () => ({ 'Content-Type': 'application/json', 'x-tangent-workspace-id': 'ws_share' }),
    hasRemoteBoardApiAccess() {
      return remoteMode
    },
    readBoardApiPayload: async (response) => response.json(),
    resolveBoardClientError: (payload, fallback) => payload?.error ?? fallback,
  },
}, { fetch: smokeFetch })

await shareClient.resolveLocalBoardShareLink('share 1', '  open sesame  ')
assert.deepEqual(calls.pop(), {
  body: undefined,
  headers: { 'x-tangent-share-password': 'open sesame' },
  method: 'GET',
  url: '/api/boards/local-share-link?shareId=share%201',
})

await shareClient.loadSharedBoardDocument('share/unsafe')
assert.deepEqual(calls.pop(), {
  body: undefined,
  headers: {},
  method: 'GET',
  url: '/api/boards/local-share-board?shareId=share%2Funsafe',
})

await shareClient.ensureLocalBoardShareLink('board_1', 'viewer', {
  expiresAt: '2026-06-01T00:00:00.000Z',
  password: 'pw',
  regenerate: true,
})
assert.deepEqual(calls.pop(), {
  body: JSON.stringify({
    accessRole: 'viewer',
    boardId: 'board_1',
    expiresAt: '2026-06-01T00:00:00.000Z',
    password: 'pw',
    regenerate: true,
  }),
  headers: { 'Content-Type': 'application/json', 'x-tangent-workspace-id': 'ws_share' },
  method: 'POST',
  url: '/api/boards/local-share-link',
})

await shareClient.revokeLocalBoardShareLink('board_1', 'share_1')
assert.deepEqual(calls.pop(), {
  body: JSON.stringify({ boardId: 'board_1', shareId: 'share_1' }),
  headers: { 'Content-Type': 'application/json', 'x-tangent-workspace-id': 'ws_share' },
  method: 'DELETE',
  url: '/api/boards/local-share-link',
})

remoteMode = true
await shareClient.resolveLocalBoardShareLink('share_2', 'pw2')
assert.deepEqual(calls.pop(), {
  body: undefined,
  headers: { 'x-tangent-share-password': 'pw2' },
  method: 'GET',
  url: 'https://api.example.test/api/v1/boards/share-links/share_2',
})

await shareClient.revokeLocalBoardShareLink('board_2', 'share_2')
assert.deepEqual(calls.pop(), {
  body: undefined,
  headers: { Authorization: 'Bearer server-token' },
  method: 'DELETE',
  url: 'https://api.example.test/api/v1/boards/board_2/share-link/share_2',
})

console.log('public share client smoke passed')

function responseFor(url) {
  const value = String(url)
  const pathname = new URL(value, 'http://smoke.local').pathname
  const method = calls.at(-1)?.method
  if (method === 'DELETE') {
    return jsonResponse({ ok: true, shareId: 'share_1' })
  }
  if (
    pathname.endsWith('/local-share-board')
    || (pathname.includes('/share-links/') && pathname.endsWith('/board'))
  ) {
    return jsonResponse({ board: { id: 'board_1' }, ok: true })
  }
  if (pathname.includes('/share-links/') || pathname.endsWith('/local-share-link')) {
    return jsonResponse({ ok: true, shareLink: { shareId: 'share_1' } })
  }
  return jsonResponse({ ok: true })
}

function jsonResponse(payload) {
  return {
    json: async () => payload,
    ok: true,
    status: 200,
  }
}

function normalizeHeaders(headers) {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}

async function loadTsModule(relativePath, stubs = {}, globals = {}) {
  const filePath = path.join(webRoot, relativePath)
  const source = await readFile(filePath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  })
  const cjsModule = { exports: {} }
  const sandbox = {
    exports: cjsModule.exports,
    module: cjsModule,
    ...globals,
    require(specifier) {
      if (specifier in stubs) return stubs[specifier]
      throw new Error(`Unexpected import in smoke: ${specifier}`)
    },
  }
  vm.runInNewContext(outputText, sandbox, { filename: filePath })
  return cjsModule.exports
}
