# Slice 1: License + API Key 管理（Dashboard Settings 集成）

**优先级**: P0 | **难度**: 中 | **预计**: 2 天 | **状态**: ✅ 已完成（状态校准）
**依赖**: Slice 0 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

> 2026-04-25 对齐：本地 API Key 能力保留为高级/降级路径；默认 AI 路由已切到官方 FastAPI 代理。

---

## 目标

将 License 激活和 API Key 管理集成到 Dashboard Settings 页面中。支持 5 个 AI Provider（Gemini、Claude、GPT、GLM、MiniMax），参考 cc-switch 的 Provider 管理架构（预设系统 + SSOT）。首次进入 Dashboard 时，如果没有任何 API Key，弹出提示引导跳转 Settings。

**设计原则**：
- 不做 Welcome 向导 — 直接进入 Dashboard
- Settings 页面是 License 和 API Key 的唯一管理入口
- Provider 元数据（base_url、test endpoint）在 Rust 侧预设，前端不硬编码
- API Key 经 AES-256-GCM 加密存 SQLite，前端永远不拿到明文

---

## Rust 侧步骤

### Step 1: Provider 预设系统

**文件**: `src-tauri/src/services/provider.rs`（新建）

参考 cc-switch 的 Provider 管理：每个 provider 有预设配置（base_url、test_endpoint、models），运行时可通过 `api_keys` 表覆盖。

```rust
struct ProviderPreset {
    id: &'static str,          // "gemini" | "claude" | "gpt" | "glm" | "minimax"
    name: &'static str,        // "Gemini" | "Claude" | "GPT" | "GLM" | "MiniMax"
    base_url: &'static str,    // 默认 API base URL
    test_endpoint: &'static str, // 验证 key 的最小端点
    test_method: &'static str, // "GET" | "POST"
    key_prefix: &'static str,  // "sk-ant-" | "sk-" 等，前端提示用
}

static PRESETS: &[ProviderPreset] = &[
    ProviderPreset {
        id: "gemini",
        name: "Gemini",
        base_url: "https://generativelanguage.googleapis.com/v1beta",
        test_endpoint: "/models?key={api_key}",
        test_method: "GET",
        key_prefix: "AI",
    },
    ProviderPreset {
        id: "claude",
        name: "Claude",
        base_url: "https://api.anthropic.com",
        test_endpoint: "/v1/models",
        test_method: "GET",
        key_prefix: "sk-ant-",
    },
    ProviderPreset {
        id: "gpt",
        name: "GPT",
        base_url: "https://api.openai.com",
        test_endpoint: "/v1/models",
        test_method: "GET",
        key_prefix: "sk-",
    },
    ProviderPreset {
        id: "glm",
        name: "GLM",
        base_url: "https://open.bigmodel.cn/api/paas",
        test_endpoint: "/v4/models",
        test_method: "GET",
        key_prefix: "",
    },
    ProviderPreset {
        id: "minimax",
        name: "MiniMax",
        base_url: "https://api.minimax.chat",
        test_endpoint: "/v1/models",
        test_method: "GET",
        key_prefix: "",
    },
];

// get_preset(provider_id) -> Option<&'static ProviderPreset>
// get_all_presets() -> Vec<ProviderPreset>  (序列化给前端)
// resolve_base_url(provider_id, custom_url) -> String  (自定义 URL 优先)
```

### Step 2: Crypto 实现

**文件**: `src-tauri/src/crypto.rs`（替换占位）

```rust
// generate_or_get_key(app_dir: &str) -> [u8; 32]
//   1. 读 {app_dir}/.enc_key
//   2. 不存在 → rand 生成 32 字节 → 写入文件 (权限 0600)
//   3. 返回密钥

// encrypt(plaintext: &str, key: &[u8; 32]) -> Vec<u8>
//   AES-256-GCM: 生成随机 12 字节 nonce → 加密 → [nonce | ciphertext]

// decrypt(blob: &[u8], key: &[u8; 32]) -> Result<String, String>
//   前 12 字节 = nonce, 剩余 = ciphertext → AES-256-GCM 解密
```

### Step 3: License 验证服务

**文件**: `src-tauri/src/services/license.rs`（新建）

```rust
// 公钥编译时硬编码
const PUBLIC_KEY: &str = "TODO: 生成 Ed25519 密钥对后填入公钥";

struct LicensePayload {
    plan: String,       // "free" | "pro"
    expires_at: String, // ISO 8601
}

// verify_license(key: &str) -> Result<LicensePayload, String>
//   1. Base64 decode → (payload_bytes, signature_bytes)
//   2. Ed25519 验签（用内嵌公钥）
//   3. 无效 → Err("LICENSE_INVALID")
//   4. 解析 JSON payload
//   5. 过期检查 → Err("LICENSE_EXPIRED")
//   6. 返回 LicensePayload

// get_trial_status() -> TrialInfo
//   从 app_config 读 first_launch_date
//   无 → 写入当前时间, 返回 { status: "trial", remaining_days: 14 }
//   有 → 计算剩余天数
```

### Step 4: API Key Commands

**文件**: `src-tauri/src/commands/api_keys.rs`（新建）

```rust
#[tauri::command]
// set_api_key(provider: String, key: String, base_url: Option<String>) -> Result<(), String>
//   1. 调用 crypto::encrypt(key, enc_key)
//   2. UPSERT api_keys 表 (provider, encrypted_key, base_url, is_valid=0)
//   注意：base_url 存为自定义覆盖，null = 使用预设

#[tauri::command]
// test_api_key(provider: String) -> Result<bool, String>
//   1. 从 api_keys 读 encrypted_key + base_url
//   2. 解密得明文 key
//   3. 从 preset 取 test_endpoint + test_method
//   4. resolve_base_url(custom, preset_default)
//   5. reqwest 发请求：
//      - Claude: GET {base}/v1/models, header x-api-key + anthropic-version
//      - GPT: GET {base}/v1/models, header Authorization: Bearer {key}
//      - Gemini: GET {base}/models?key={key}
//      - GLM: GET {base}/v4/models, header Authorization: Bearer {jwt_token}
//      - MiniMax: GET {base}/v1/models, header Authorization: Bearer {key}
//   6. 200 → is_valid=1, last_tested_at=now
//   7. 非200 → is_valid=0, 返回错误信息

#[tauri::command]
// get_api_key_status(provider: String) -> Result<KeyStatus, String>
//   返回 { isSet, isValid, lastTested, baseUrl }
//   不返回密钥明文

#[tauri::command]
// get_all_providers() -> Result<Vec<ProviderInfo>, String>
//   合并 preset 数据 + api_keys 表状态
//   返回 [{ id, name, keyPrefix, baseUrl, isSet, isValid, lastTested }]

#[tauri::command]
// remove_api_key(provider: String) -> Result<(), String>
//   DELETE from api_keys WHERE provider = ?
```

### Step 5: License Commands

**文件**: `src-tauri/src/commands/license.rs`（新建）

```rust
#[tauri::command]
// activate_license(key: String) -> Result<LicenseInfo, String>
//   1. verify_license(key)
//   2. 存入 app_config: license_key=value, license_plan=plan
//   3. 返回 { status, plan, expiresAt }

#[tauri::command]
// check_license_status() -> Result<LicenseInfo, String>
//   1. 从 app_config 读 license_key
//   2. 无 → 检查试用状态
//   3. 有 → 验签（复用 verify_license）
//   4. 返回 { status, plan, expiresAt, trialEndsAt }

#[tauri::command]
// deactivate_license() -> Result<(), String>
//   DELETE app_config WHERE key IN ('license_key', 'license_plan')
```

### Step 6: SQL Migration 002

**文件**: `src-tauri/migrations/002_api_keys_ext.sql`（新建）

```sql
-- 扩展 api_keys 表支持自定义 base_url 和 provider 配置
ALTER TABLE api_keys ADD COLUMN base_url TEXT;
ALTER TABLE api_keys ADD COLUMN config_json TEXT;

-- 更新 schema version
UPDATE schema_version SET version = 2;
```

### Step 7: 注册 Commands

**文件**: `src-tauri/src/lib.rs` — 更新 invoke_handler

```rust
.invoke_handler(tauri::generate_handler![
    commands::health::health_check,
    commands::app_config::get_config,
    commands::app_config::set_config,
    commands::api_keys::set_api_key,
    commands::api_keys::test_api_key,
    commands::api_keys::get_api_key_status,
    commands::api_keys::get_all_providers,
    commands::api_keys::remove_api_key,
    commands::license::activate_license,
    commands::license::check_license_status,
    commands::license::deactivate_license,
])
```

同时更新 `services/mod.rs` 和 `commands/mod.rs` 注册新模块。

---

## 前端步骤

### Step 8: 类型定义扩展

**文件**: `frontend/src/types/license.ts` — 更新

```typescript
export type LicenseStatus = "active" | "trial" | "expired" | "unknown"
export type LicensePlan = "free" | "pro"

export interface LicenseInfo {
  status: LicenseStatus
  plan: LicensePlan
  trialEndsAt: string | null
  expiresAt: string | null
}

// 新增 — Provider 相关
export interface KeyStatus {
  isSet: boolean
  isValid: boolean | null
  lastTested: string | null
  baseUrl: string | null
}

export interface ProviderInfo {
  id: string
  name: string
  keyPrefix: string
  baseUrl: string           // 预设 base URL
  isSet: boolean
  isValid: boolean | null
  lastTested: string | null
}
```

### Step 9: Tauri IPC 封装扩展

**文件**: `frontend/src/services/tauri.ts` — 扩展

```typescript
// License
activateLicense: (key: string) => invoke<LicenseInfo>("activate_license", { key }),
checkLicenseStatus: () => invoke<LicenseInfo>("check_license_status"),
deactivateLicense: () => invoke<void>("deactivate_license"),

// API Keys
setApiKey: (provider: string, key: string, baseUrl?: string) =>
  invoke<void>("set_api_key", { provider, key, baseUrl }),
testApiKey: (provider: string) => invoke<boolean>("test_api_key", { provider }),
getApiKeyStatus: (provider: string) => invoke<KeyStatus>("get_api_key_status", { provider }),
getAllProviders: () => invoke<ProviderInfo[]>("get_all_providers"),
removeApiKey: (provider: string) => invoke<void>("remove_api_key", { provider }),
```

### Step 10: License Store 重写

**文件**: `frontend/src/store/licenseStore.ts` — 替换占位

```typescript
interface LicenseStore {
  status: LicenseStatus
  plan: LicensePlan
  trialEndsAt: string | null
  expiresAt: string | null
  isLoading: boolean

  checkStatus: () => Promise<void>       // 调用 tauri.checkLicenseStatus
  activate: (key: string) => Promise<boolean>
  deactivate: () => Promise<void>

  get isPro(): boolean
  get trialDaysLeft(): number | null
}
```

### Step 11: API Key Store 重写

**文件**: `frontend/src/store/apiKeyStore.ts` — 替换占位

```typescript
interface ApiKeyStore {
  providers: ProviderInfo[]         // 从 Rust 侧拉取
  testing: Record<string, boolean>  // provider → isTesting
  isLoading: boolean

  loadProviders: () => Promise<void>       // 调用 getAllProviders
  setKey: (provider: string, key: string, baseUrl?: string) => Promise<void>
  testKey: (provider: string) => Promise<boolean>
  removeKey: (provider: string) => Promise<void>

  isProviderReady: (provider: string) => boolean
  hasAnyKey: () => boolean                  // 是否配置了至少一个 key
}
```

### Step 12: Settings 页面 — 主管理界面

**文件**: `frontend/src/pages/SettingsPage.tsx` — 重写

```
布局: Settings 左侧 tab | 右侧内容区（Cal.com 风格白底卡片）

Tab 1: API Keys（默认 tab）
  标题: "AI Provider 配置"
  说明: "TANGENT 使用你自己的 API Key，密钥经本地加密存储，不会发送到任何第三方服务器"

  每个 provider 一个卡片:
  ┌──────────────────────────────────────────────────┐
  │ ● Gemini                           状态: ✓/✗/—  │
  │                                                  │
  │ API Key   [••••••••••••••••]  [测试] [删除]      │
  │ Base URL  [https://generativelanguage.../v1beta]  │
  │                    (可编辑, placeholder=预设值)    │
  └──────────────────────────────────────────────────┘

  5 个 provider 卡片: Gemini, Claude, GPT, GLM, MiniMax
  - 密钥输入框: type=password, placeholder 显示 key_prefix 提示
  - Base URL: 可选覆盖, placeholder 显示预设值
  - [测试] 按钮: loading → ✓ 成功 / ✗ 失败+错误信息
  - [删除] 按钮: 红色, 带 confirm dialog
  - 状态指示: ●绿(有效) / ●红(无效) / ●灰(未配置)

Tab 2: License
  当前状态卡片:
  - Pro 已激活: "Pro 计划" + 到期日期
  - 试用中: "免费试用" + 剩余天数
  - Free: "Free 计划"

  激活区域:
  - 输入框 "输入 License Key"
  - [激活] 按钮
  - 已激活时显示 [停用] 按钮

Tab 3: 通用
  - 工作空间路径 (只读显示)
  - 主题切换 (placeholder for Slice 9)
  - 语言切换 (placeholder for Slice 9)
```

### Step 13: WelcomePage 简化

**文件**: `frontend/src/pages/WelcomePage.tsx` — 简化为 Splash

```
- 保持当前简单布局
- 添加 useEffect: 进入时调用 checkStatus + loadProviders
- 如果 status 已知, 自动 navigate("/dashboard")
- 保留 "Enter Workspace" 按钮 (手动跳过)
- 移除 license 状态显示 (放在 Settings 里)
```

### Step 14: Dashboard 无 Key 提示

**文件**: `frontend/src/pages/DashboardPage.tsx` — 添加提示

```
在 Dashboard 顶部添加条件提示条:
- 条件: apiKeyStore.hasAnyKey() === false
- 内容: "你还没有配置 AI API Key。点击前往 Settings 配置。"
- 样式: 黄色底条 + 链接到 /settings
- 配置至少一个 key 后自动消失
```

### Step 15: TopNav 状态更新

**文件**: `frontend/src/components/TopNav.tsx` — 更新

```
- 右侧显示当前 license 状态
- 点击状态标签 → navigate("/settings")
- Provider ready 数量指示 (可选, 如 "2/5 providers ready")
```

---

## 验收清单

- [ ] `npx tauri dev` 启动正常，无编译错误
- [ ] Welcome 页面自动跳转到 Dashboard
- [ ] Settings > API Keys tab 显示 5 个 Provider 卡片
- [ ] 输入 API Key → 加密存储，DevTools 看不到明文
- [ ] 测试按钮实际验证 Key 有效性（每个 provider 调对应 API）
- [ ] 测试成功 ✓ / 失败 ✗ + 错误信息
- [ ] Base URL 可自定义覆盖预设值
- [ ] 删除按钮能清除已存储的 Key
- [ ] Settings > License tab 能激活/停用 License
- [ ] 无效 Key 提示「密钥无效」
- [ ] 试用期倒计时正确显示
- [ ] 无 API Key 时 Dashboard 顶部显示提示条
- [ ] TopNav 显示 license 状态 + 点击跳转 Settings
- [ ] 重启应用后 License 和 Key 状态保持
- [ ] 所有新文件 < 300 行

---

## 关键文件

| 文件 | 操作 |
|------|------|
| `src-tauri/src/services/provider.rs` | 新建 — Provider 预设系统 |
| `src-tauri/src/services/license.rs` | 新建 — License 验证 |
| `src-tauri/src/crypto.rs` | 重写 — AES-256-GCM + Ed25519 |
| `src-tauri/src/commands/api_keys.rs` | 新建 — API Key CRUD |
| `src-tauri/src/commands/license.rs` | 新建 — License 激活/检查/停用 |
| `src-tauri/src/commands/mod.rs` | 修改 — 注册新模块 |
| `src-tauri/src/services/mod.rs` | 修改 — 注册新模块 |
| `src-tauri/src/lib.rs` | 修改 — 注册新 commands |
| `src-tauri/migrations/002_api_keys_ext.sql` | 新建 — 扩展 api_keys 表 |
| `frontend/src/types/license.ts` | 修改 — 加 ProviderInfo/KeyStatus |
| `frontend/src/services/tauri.ts` | 修改 — 加 License + API Key IPC |
| `frontend/src/store/licenseStore.ts` | 重写 — 接入 Tauri IPC |
| `frontend/src/store/apiKeyStore.ts` | 重写 — 接入 Tauri IPC + 5 providers |
| `frontend/src/pages/SettingsPage.tsx` | 重写 — Tabbed Settings UI |
| `frontend/src/pages/WelcomePage.tsx` | 修改 — 简化为 Splash |
| `frontend/src/pages/DashboardPage.tsx` | 修改 — 加无 Key 提示条 |
| `frontend/src/components/TopNav.tsx` | 修改 — License 状态 + 跳转 |

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 1 ✅
- [ ] phase1-mvp.md → Slice 1 ✅
- [ ] git commit: "feat(slice1): license + API key management in settings"
