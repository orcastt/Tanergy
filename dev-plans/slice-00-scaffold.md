# Slice 0: Tauri 脚手架 + SQLite

**优先级**: P0 | **难度**: 中 | **预计**: 2 天 | **状态**: ⬜ 未开始
**依赖**: 无 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

搭建 Tauri v2 桌面应用骨架，前端 React + TypeScript + Vite，Rust 侧 SQLite 数据库初始化就绪，`npm run tauri dev` 一键启动开发环境。

---

## Rust 侧步骤

### Step 1: 初始化 Tauri 项目

```bash
npm create tauri-app@latest -- tangent-desktop --template react-ts
```

或手动在现有项目根目录添加 Tauri：

```bash
npm install -D @tauri-apps/cli@latest
npx tauri init
```

Tauri 配置要点：
- `tauri.conf.json` 中设置 app identifier: `com.tangent.desktop`
- 窗口默认尺寸 1440×900，最小 1024×680
- 开发服务器 URL: `http://localhost:5173`
- 启用 `fs`、`dialog`、`shell` 权限

### Step 2: Rust 依赖 — `src-tauri/Cargo.toml`

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
reqwest = { version = "0.12", features = ["json"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
ed25519-dalek = { version = "2", features = ["serde"] }
base64 = "0.22"
aes-gcm = "0.10"
rand = "0.8"
```

### Step 3: Rust 目录结构

```
src-tauri/
├── src/
│   ├── main.rs           ← Tauri 入口
│   ├── lib.rs            ← Command 注册 + 插件注册
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── app_config.rs ← get/set app config
│   │   └── health.rs     ← 健康检查 command
│   ├── db/
│   │   ├── mod.rs        ← DB 连接管理
│   │   ├── schema.rs     ← SQLite schema 定义
│   │   └── migrations.rs ← 迁移执行逻辑
│   ├── services/
│   │   └── mod.rs
│   └── crypto.rs         ← AES-256-GCM 加解密（占位）
├── Cargo.toml
├── tauri.conf.json
├── icons/                ← 应用图标占位
└── migrations/
    └── 001_init.sql      ← 初始 schema
```

### Step 4: `src-tauri/src/main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tangent_lib::run();
}
```

### Step 5: `src-tauri/src/lib.rs`

```rust
use tauri::Manager;

mod commands;
mod db;
mod services;
mod crypto;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 初始化数据库
            let app_dir = app.path().app_data_dir()?.to_string_lossy().to_string();
            db::init_database(&app_dir)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::health::health_check,
            commands::app_config::get_config,
            commands::app_config::set_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tANGENT");
}
```

### Step 6: `src-tauri/src/db/mod.rs`

- `init_database(app_dir: &str)` — 创建 `tangent.db`，执行 migrations
- `get_connection()` — 返回 `rusqlite::Connection`
- 使用 `std::sync::Mutex<Connection>` 包装（单线程安全）

### Step 7: `src-tauri/migrations/001_init.sql`

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
INSERT OR IGNORE INTO schema_version (version) VALUES (1);

CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  provider      TEXT PRIMARY KEY,
  encrypted_key BLOB NOT NULL,
  is_valid      INTEGER NOT NULL DEFAULT 0,
  last_tested_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflows (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  graph_json     TEXT NOT NULL DEFAULT '{}',
  thumbnail_path TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workflows_updated ON workflows(updated_at);

CREATE TABLE IF NOT EXISTS assets (
  id                TEXT PRIMARY KEY,
  workflow_id       TEXT REFERENCES workflows(id) ON DELETE CASCADE,
  node_id           TEXT NOT NULL,
  type              TEXT NOT NULL CHECK(type IN ('image','video','audio','html')),
  file_path         TEXT NOT NULL,
  original_filename TEXT,
  size_bytes        INTEGER NOT NULL,
  mime_type         TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_workflow ON assets(workflow_id);

CREATE TABLE IF NOT EXISTS execution_logs (
  id            TEXT PRIMARY KEY,
  workflow_id   TEXT,
  node_id       TEXT NOT NULL,
  node_type     TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  duration_ms   INTEGER,
  status        TEXT NOT NULL CHECK(status IN ('running','success','failed','cancelled')),
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_workflow ON execution_logs(workflow_id);
```

### Step 8: `src-tauri/src/commands/health.rs`

```rust
#[tauri::command]
pub fn health_check() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "status": "ok",
        "version": "0.1.0"
    }))
}
```

### Step 9: `src-tauri/src/commands/app_config.rs`

```rust
// get_config(key) -> Option<String>
// set_config(key, value) -> Result<(), String>
```

读/写 `app_config` 表的简单 CRUD。

---

## 前端步骤

### Step 10: 安装前端依赖

```bash
cd frontend
npm install @xyflow/react zustand tailwindcss @tailwindcss/vite \
  react-router-dom i18next react-i18next \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tooltip @radix-ui/react-tabs \
  @tauri-apps/api
```

注意：移除 `axios`（不再需要 HTTP 客户端），新增 `@tauri-apps/api`。

### Step 11: `frontend/vite.config.ts`

- 配置 Tailwind v4 plugin
- 配置路径别名 `@/ → src/`
- 移除 `/api` 和 `/ws` 代理（不再需要）
- 添加 Tauri 相关配置

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 5174 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
```

### Step 12: 创建前端目录结构

```
frontend/src/
├── components/
│   └── ui/               ← Radix 基础组件封装
├── nodes/
│   └── base/
│       └── NodeBase.tsx  ← 占位，Slice 3 填充
├── canvas/
│   └── Canvas.tsx        ← 占位，Slice 3 填充
├── skills/
├── pages/
│   ├── WelcomePage.tsx   ← 首次启动向导占位
│   ├── DashboardPage.tsx ← 占位
│   ├── CanvasPage.tsx    ← 占位，含 React Flow 容器
│   └── SettingsPage.tsx  ← 占位
├── store/
│   ├── licenseStore.ts   ← License 状态（占位）
│   ├── apiKeyStore.ts    ← API Key 管理（占位）
│   └── workflowStore.ts  ← 工作流状态（占位）
├── services/
│   └── tauri.ts          ← Tauri IPC invoke 封装
├── hooks/
├── types/
│   ├── node.ts           ← 端口类型、节点类型枚举
│   └── license.ts        ← License 类型定义
├── lib/
│   ├── cn.ts             ← clsx + tailwind-merge 工具
│   └── executionEngine.ts ← 占位，Slice 3 填充
├── i18n/
│   ├── index.ts          ← i18next 配置
│   └── locales/
│       ├── zh.json       ← 中文（默认）
│       └── en.json       ← 英文
├── App.tsx               ← 路由配置（BrowserRouter）
└── main.tsx              ← 入口，挂载 App
```

### Step 13: `frontend/src/lib/cn.ts`

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

### Step 14: `frontend/src/services/tauri.ts`

```typescript
import { invoke } from "@tauri-apps/api/core";

// 类型安全的 invoke 封装
export const tauri = {
  healthCheck: () => invoke<{ status: string; version: string }>("health_check"),
  getConfig: (key: string) => invoke<string | null>("get_config", { key }),
  setConfig: (key: string, value: string) => invoke<void>("set_config", { key, value }),
};
```

### Step 15: `frontend/src/App.tsx`

路由配置（简化，无认证路由守卫）：
- `/` → WelcomePage（首次启动向导）
- `/dashboard` → DashboardPage
- `/canvas/:id` → CanvasPage
- `/settings` → SettingsPage

### Step 16: Tailwind + theme 集成

- `frontend/src/index.css`：引入 Cal Sans、Inter、Roboto Mono 字体
- 配置 Tailwind 使用 `reference/theme.ts` 中的颜色、阴影、圆角
- 基础样式：body `#f5f5f5` 背景，`#242424` 文字，Inter 字体

### Step 17: 字体引入

在 `index.css` 中引入：
- Cal Sans（自托管或 Google Fonts）
- Inter（Google Fonts）
- Roboto Mono（Google Fonts）

---

## Git 步骤

### Step 18: Git 初始化

```bash
cd TangentAgent
git add .
git commit -m "Slice 0: Tauri scaffold (React + Rust + SQLite)"
```

---

## 验收清单

- [ ] `npm run tauri dev` 启动桌面窗口无报错
- [ ] 桌面窗口显示前端页面（哪怕是空白页）
- [ ] Tauri health_check command 调用成功（返回 `{ status: "ok" }`）
- [ ] SQLite 数据库文件 `tangent.db` 在 app data 目录自动创建
- [ ] 数据库包含全部 6 张表（schema_version, app_config, api_keys, workflows, assets, execution_logs）
- [ ] 前端路由 `/` `/dashboard` `/canvas` 不报错
- [ ] `tauri.ts` 的 `getConfig` / `setConfig` 读写正常
- [ ] Cal Sans + Inter 字体在前端加载成功
- [ ] `find . -name '*.ts' -o -name '*.tsx' -o -name '*.rs' | xargs wc -l | sort -rn | head -10` 所有文件 < 300 行
- [ ] `git log` 有初始 commit

---

## 完成后更新

- [ ] 本文件状态改为 ✅ 已完成
- [ ] project_state.md 当前阶段改为 Slice 1
- [ ] phase1-mvp.md Slice 0 状态改为 ✅
