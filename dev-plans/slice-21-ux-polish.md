# Slice 21: UX Polish & Pre-launch Cleanup

> 状态: ⬜ 待开发
> 优先级: P1
> 前置: Slice 0-19 全部完成，Bug 修复完成
> 估算: 2-3 天

> 2026-04-25 对齐：本 Slice 仍为后续体验优化；当前 P0 已转为 Html Editor 手测、Admin 联调和部署收口。

---

## 目标

上线前的体验打磨，解决已知 UX 问题 + 搭建自动化测试基础。

---

## 任务清单

### 1. 画布缩放时文字清晰度 (P1)

**问题**: 缩放 >150% 或 <50% 时节点文字模糊

**方案**:
- 检查 React Flow 的 `devicePixelRatio` 处理
- 确保 Canvas 的 `minZoom` / `maxZoom` 合理（建议 0.3-2.0）
- 评估是否需要在极端缩放下切换渲染策略

**文件**: `frontend/src/canvas/Canvas.tsx`, `frontend/src/index.css`

### 2. 节点执行失败的友好提示 (P1)

**问题**: 节点执行失败时没有用户友好提示

**方案**:
- NodeBase 增加 `error` 状态样式（红色边框 + 错误图标）
- 执行引擎 catch 错误后，在节点 data 中写入 `error` 字段
- 节点底部显示 "执行失败: [简短原因]" + 重试按钮

**文件**: `frontend/src/nodes/base/NodeBase.tsx`, `frontend/src/lib/executionEngine.ts`

### 3. AuthGuard 恢复 (P0)

**问题**: 本地测试时临时禁用了登录检查

**方案**:
- 生产环境恢复 AuthGuard
- 增加 `VITE_SKIP_AUTH` 环境变量控制（dev 模式跳过，prod 模式不跳过）

**文件**: `frontend/src/components/AuthGuard.tsx`

### 4. ErrorBoundary 生产化 (P2)

**问题**: CanvasPage 的 ErrorBoundary 目前是调试用的红色错误页

**方案**:
- 生产环境显示友好提示："画布加载出错，请刷新页面或联系客服"
- 提供刷新按钮 + 返回 Dashboard 按钮
- 可选：上报错误到后端日志

**文件**: `frontend/src/pages/CanvasPage.tsx`

### 5. 自动化测试框架 (P1)

**目标**: 搭建 pytest + Vitest 基础框架

**后端 (pytest)**:
- `backend/tests/test_auth.py` — OTP 发送/验证流程
- `backend/tests/test_credits.py` — 积分扣减/充值
- `backend/tests/test_proxy.py` — 多 provider 代理路由
- `backend/tests/test_admin.py` — Admin CRUD

**前端 (Vitest)**:
- `frontend/src/__tests__/canvasStore.test.ts` — 节点/边 CRUD
- `frontend/src/__tests__/executionEngine.test.ts` — 拓扑排序、数据传递
- `frontend/src/__tests__/nodeBuilder.test.ts` — Skill 构建校验

**配置文件**:
- `backend/pytest.ini` 或 `pyproject.toml [tool.pytest]`
- `frontend/vitest.config.ts`

### 6. 工作流自动保存优化 (P2)

**问题**: 当前每次操作都触发保存，频繁写入

**方案**:
- debounce 500ms 后保存
- 标题栏显示保存状态（已保存 / 保存中...）

**文件**: `frontend/src/pages/CanvasPage.tsx`

---

## 验收标准

- [ ] 缩放 30%-200% 范围内节点文字可读
- [ ] 节点执行失败有友好提示 + 重试按钮
- [ ] 生产环境 AuthGuard 正常工作
- [ ] ErrorBoundary 显示用户友好提示
- [ ] 后端至少 4 个测试文件，前端至少 3 个测试文件
- [ ] 工作流自动保存有 debounce
