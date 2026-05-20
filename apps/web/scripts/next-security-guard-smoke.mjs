import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(scriptDir, '..')
const nextConfig = (await import('../next.config.mjs')).default

const csrfGuard = await loadTsModule('src/app/api/_lib/csrfGuard.ts', {
  'next/server': {
    NextResponse: {
      json(payload, init = {}) {
        return new Response(JSON.stringify(payload), {
          headers: { 'content-type': 'application/json' },
          status: init.status ?? 200,
        })
      },
    },
  },
})
const adminPolicy = await loadTsModule('src/app/api/admin-proxy/_lib/adminProxyPolicy.ts')
const localRuntimeWithoutRemote = await loadRuntimeBridgePolicy()
const localRuntimeWithRemote = await loadRuntimeBridgePolicy({
  NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test',
})
const productionRuntimeWithoutRemote = await inspectRuntimeBridgePolicy({
  NODE_ENV: 'production',
})
const productionRuntimeWithExplicitFallback = await inspectRuntimeBridgePolicy({
  NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_AI_BRIDGE: '1',
  NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_ASSET_BRIDGE: '1',
  NEXT_PUBLIC_TANGENT_ENABLE_LOCAL_BOARD_BRIDGE: '1',
  NODE_ENV: 'production',
})
const remotePersistenceApi = await loadPersistenceApi({
  NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test',
}, { hostname: 'app.example.test' })
const invalidRemotePersistenceApi = await loadPersistenceApi({
  NEXT_PUBLIC_API_BASE_URL: 'not a url',
}, { hostname: 'app.example.test' })
const localPersistenceApi = await loadPersistenceApi({}, { hostname: 'localhost' })

assert.equal(csrfGuard.rejectCrossSiteMutation(new Request('https://app.test/api/check')), null)
assert.equal(
  csrfGuard.rejectCrossSiteMutation(new Request('https://app.test/api/check', {
    headers: { cookie: '__session=abc', origin: 'https://app.test' },
    method: 'POST',
  })),
  null,
)
assert.equal(
  csrfGuard.rejectCrossSiteMutation(new Request('https://app.test/api/check', {
    headers: { authorization: 'Bearer token' },
    method: 'POST',
  })),
  null,
)
assert.equal(
  csrfGuard.rejectCrossSiteMutation(new Request('https://app.test/api/check', {
    headers: { cookie: '__session=abc', origin: 'https://evil.test' },
    method: 'POST',
  }))?.status,
  403,
)
assert.equal(
  csrfGuard.rejectCrossSiteMutation(new Request('https://app.test/api/check', {
    headers: { cookie: '__session=abc' },
    method: 'POST',
  }))?.status,
  403,
)
assert.equal(
  csrfGuard.rejectCrossSiteMutation(new Request('https://app.test/api/check', {
    headers: { 'sec-fetch-site': 'cross-site', origin: 'https://app.test' },
    method: 'POST',
  }))?.status,
  403,
)

assertAdminPath(adminPolicy.resolveAdminProxyPath('GET', ['ai', 'models']), '/ai/models')
assertAdminPath(
  adminPolicy.resolveAdminProxyPath('PUT', ['finance', 'plan-catalog', 'team_start']),
  '/finance/plan-catalog/team_start',
)
assert.equal(adminPolicy.resolveAdminProxyPath('POST', ['evil']).status, 404)
assert.equal(adminPolicy.resolveAdminProxyPath('GET', ['..', 'me']).status, 404)
assert.equal(adminPolicy.resolveAdminProxyPath('GET', ['users', 'user/123']).status, 404)
assert.equal(
  adminPolicy.resolveAdminProxyPath('POST', ['operator', 'workspaces', 'ws-1', 'boards', 'board-1', 'copy']).ok,
  true,
)
const nextHeaders = await nextConfig.headers()
const globalHeaders = nextHeaders.find((entry) => entry.source === '/:path*')?.headers ?? []
assertHeader(globalHeaders, 'Content-Security-Policy')
assertHeader(globalHeaders, 'X-Content-Type-Options', 'nosniff')
assertHeader(globalHeaders, 'X-Frame-Options', 'DENY')
assertHeader(globalHeaders, 'Permissions-Policy')
assert(globalHeaders.find((header) => header.key === 'Content-Security-Policy')?.value.includes("frame-ancestors 'none'"))
assert.equal(localRuntimeWithoutRemote.canUseLocalBoardBridge(), true)
assert.equal(localRuntimeWithoutRemote.canUseLocalAiBridge(), true)
assert.equal(localRuntimeWithoutRemote.canUseLocalAssetBridge(), true)
assert.equal(localRuntimeWithRemote.canUseLocalBoardBridge(), false)
assert.equal(localRuntimeWithRemote.canUseLocalAiBridge(), false)
assert.equal(localRuntimeWithRemote.canUseLocalAssetBridge(), false)
assert.throws(
  () => localRuntimeWithRemote.assertLocalBoardBridgeAvailable(),
  localRuntimeWithRemote.LocalRuntimeBridgeDisabledError,
)
assert.throws(
  () => localRuntimeWithRemote.assertLocalAiBridgeAvailable(),
  localRuntimeWithRemote.LocalRuntimeBridgeDisabledError,
)
assert.throws(
  () => localRuntimeWithRemote.assertLocalAssetBridgeAvailable(),
  localRuntimeWithRemote.LocalRuntimeBridgeDisabledError,
)
assert.equal(productionRuntimeWithoutRemote.board, false)
assert.equal(productionRuntimeWithoutRemote.ai, false)
assert.equal(productionRuntimeWithoutRemote.asset, false)
assert.equal(productionRuntimeWithExplicitFallback.board, true)
assert.equal(productionRuntimeWithExplicitFallback.ai, true)
assert.equal(productionRuntimeWithExplicitFallback.asset, true)
assert.deepEqual(
  toPlainObject(remotePersistenceApi.persistenceJsonHeaders(testWorkspace())),
  {
    'Content-Type': 'application/json',
    'x-tangent-workspace-id': 'ws_test',
  },
)
assert.deepEqual(
  toPlainObject(invalidRemotePersistenceApi.persistenceAuthHeaders(testWorkspace())),
  { 'x-tangent-workspace-id': 'ws_test' },
)
assert.deepEqual(
  toPlainObject(localPersistenceApi.persistenceAuthHeaders(testWorkspace())),
  {
    'x-tangent-plan-key': 'team_start',
    'x-tangent-user-email': 'owner@example.test',
    'x-tangent-user-id': 'user_test',
    'x-tangent-user-name': 'Owner Test',
    'x-tangent-workspace-id': 'ws_test',
    'x-tangent-workspace-kind': 'team',
    'x-tangent-workspace-name': 'Test Workspace',
    'x-tangent-workspace-role': 'owner',
  },
)
await assertNextWriteRoutesHaveMutationGuard()

console.log('next security guard smoke passed')

function assertAdminPath(result, expectedPath) {
  assert.equal(result.ok, true)
  assert.equal(result.path, expectedPath)
}

function assertHeader(headers, key, expectedValue) {
  const header = headers.find((entry) => entry.key === key)
  assert(header, `Missing ${key}`)
  if (expectedValue) assert.equal(header.value, expectedValue)
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
    process,
    require(specifier) {
      if (specifier in stubs) return stubs[specifier]
      throw new Error(`Unexpected import in smoke: ${specifier}`)
    },
    Request,
    Response,
    URL,
    ...globals,
  }
  vm.runInNewContext(outputText, sandbox, { filename: filePath })
  return cjsModule.exports
}

async function loadRuntimeBridgePolicy(env = {}) {
  return withEnv(env, () => loadTsModule('src/features/api/runtimeBridgePolicy.ts'))
}

async function inspectRuntimeBridgePolicy(env = {}) {
  return withEnv(env, async () => {
    const policy = await loadTsModule('src/features/api/runtimeBridgePolicy.ts')
    return {
      ai: policy.canUseLocalAiBridge(),
      asset: policy.canUseLocalAssetBridge(),
      board: policy.canUseLocalBoardBridge(),
    }
  })
}

async function loadPersistenceApi(env = {}, browser = { hostname: 'app.example.test' }) {
  return withEnv(env, () => loadTsModule('src/features/api/persistenceApi.ts', {
    '@/features/auth/mockSession': {
      getSessionRequestHeaders(workspace) {
        return {
          'x-tangent-plan-key': workspace.planKey,
          'x-tangent-user-email': 'owner@example.test',
          'x-tangent-user-id': 'user_test',
          'x-tangent-user-name': 'Owner Test',
          'x-tangent-workspace-id': workspace.id,
          'x-tangent-workspace-kind': workspace.kind,
          'x-tangent-workspace-name': workspace.name,
          'x-tangent-workspace-role': workspace.role,
        }
      },
    },
    './runtimeBridgePolicy': {
      hasConfiguredRemoteApiBaseUrl() {
        return Boolean(process.env.NEXT_PUBLIC_API_BASE_URL?.trim())
      },
    },
  }, {
    window: {
      location: { hostname: browser.hostname },
      setTimeout,
    },
  }))
}

async function withEnv(overrides, callback) {
  const previous = {}
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key]
    process.env[key] = overrides[key]
  }
  try {
    return await callback()
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previous[key]
      }
    }
  }
}

function testWorkspace() {
  return {
    id: 'ws_test',
    kind: 'team',
    name: 'Test Workspace',
    planKey: 'team_start',
    role: 'owner',
  }
}

function toPlainObject(value) {
  return Object.fromEntries(Object.entries(value))
}

async function assertNextWriteRoutesHaveMutationGuard() {
  const apiRoot = path.join(webRoot, 'src/app/api')
  const routeFiles = await listRouteFiles(apiRoot)
  const writeRoutePattern = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/
  const missingGuards = []
  for (const routeFile of routeFiles) {
    const source = await readFile(routeFile, 'utf8')
    if (!writeRoutePattern.test(source)) continue
    if (source.includes('rejectCrossSiteMutation') || source.includes('status: 501')) continue
    missingGuards.push(path.relative(webRoot, routeFile))
  }
  assert.deepEqual(missingGuards, [])
}

async function listRouteFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listRouteFiles(fullPath))
    } else if (entry.isFile() && entry.name === 'route.ts') {
      files.push(fullPath)
    }
  }
  return files
}
