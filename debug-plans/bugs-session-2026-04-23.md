# Bug 修复记录 — 2026-04-23 本地测试会话

## 已修复 Bug

### BUG-001: 旧工作流加载白屏
- **症状**: 点击以前创建的工作流（如 E-commerce）显示空白页
- **根因**: `WorkflowDetail.graph_json` 类型为 `String`，但旧工作流 DB 中 `graph_json` 为 NULL。Rust `row.get::<_, String>()` 无法将 NULL 转为 String，导致 `get_workflow` 命令失败
- **修复**: `graph_json` 类型改为 `Option<String>`，前端已有 null 处理
- **文件**: `src-tauri/src/commands/workflow.rs`

### BUG-002: Image List 节点崩溃
- **症状**: 创建 Image List 节点后画布白屏，ErrorBoundary 报 "Cannot access 'removeImageInput' before initialization"
- **根因**: `useMemo` 引用了定义在其后的 `useCallback`（`removeImageInput`）
- **修复**: 将 `addImageInput` 和 `removeImageInput` 的 `useCallback` 移到 `useMemo` 之前
- **文件**: `frontend/src/nodes/ImageListNode.tsx`

### BUG-003: Image List 生成 4 张相同图片
- **症状**: 设置 count=4 生成图片，结果 4 张完全一样
- **根因**: 文件名格式 `{node_id}_{plan_id}.png`，当 plans 无 id 字段时 plan_id 默认 "img"，4 张图写入同一文件，后者覆盖前者
- **修复**: 文件名改为 `{node_id}_{plan_id}_{序号}.png`，序号保证唯一
- **文件**: `src-tauri/src/commands/execute/media.rs`

### BUG-004: Image Editor 返回跳到 Dashboard
- **症状**: Image Editor 的 Back 按钮返回 Dashboard 而非 Canvas；再进入工作流自动跳到 Editor
- **根因**: CanvasPage 的 Back 按钮没有检查 editor 状态；editorNodeId 在 Canvas 卸载时未清理
- **修复**: Back 按钮先检查 `editorNodeId`，有则只关闭 editor；Canvas 组件卸载时 closeEditor + closeLightbox
- **文件**: `frontend/src/pages/CanvasPage.tsx`, `frontend/src/canvas/Canvas.tsx`

### BUG-005: AuthGuard 阻止本地测试
- **症状**: 欢迎页点 "Enter Workspace" 被重定向回首页
- **根因**: `isLoggedIn` 需要 FastAPI 后端 JWT，本地测试无后端
- **修复**: 临时禁用 AuthGuard 的登录检查（生产前恢复）
- **文件**: `frontend/src/components/AuthGuard.tsx`

### BUG-006: 画布 fitView 导致 200% 缩放
- **症状**: 节点少时画布自动放大到 200%，每次重渲染都会触发
- **根因**: `<ReactFlow fitView>` 每次渲染都执行 fitView，自动缩放到包含所有节点
- **修复**: 移除 `fitView` prop，改用 `defaultViewport={{ x: 0, y: 0, zoom: 1 }}`
- **文件**: `frontend/src/canvas/Canvas.tsx`

### BUG-007: 节点显示模糊
- **症状**: 画布上所有节点文字和图形看起来分辨率低
- **根因**: `NodeBase` 的 `willChange: "transform"` 强制 GPU 光栅化，缩放时降质
- **修复**: 移除 `willChange: transform`，添加 `backface-visibility: hidden` + `subpixel-antialiased`
- **文件**: `frontend/src/nodes/base/NodeBase.tsx`, `frontend/src/index.css`

### BUG-008: 连线无法选择/删除
- **症状**: 鼠标很难选中连线，选中后也无法删除
- **修复**: 新建 `DeletableEdge` 自定义边组件（20px 宽命中区域 + hover 高亮 + 中点 − 按钮）；`canvasStore` 新增 `selectedEdgeIds`；Delete 键删除选中边
- **文件**: `frontend/src/canvas/DeletableEdge.tsx`, `frontend/src/store/canvasStore.ts`, `frontend/src/store/canvasActions.ts`

### BUG-009: Image List output 预览与 Gallery 冲突
- **症状**: Image List 节点 done 状态下显示图片预览网格，和 Image Gallery 的预览打架
- **修复**: done 状态改为显示 "已生成 N 张图片" 文字；output port 不再在底部标签栏显示
- **文件**: `frontend/src/nodes/ImageListNode.tsx`, `frontend/src/nodes/base/NodeBase.tsx`

---

## 待修复 / 待验证

### PENDING-001: 画布缩放时文字清晰度
- **症状**: 缩放到 >150% 或 <50% 时节点文字仍然有些模糊
- **可能方案**: 检查 React Flow 的 devicePixelRatio 处理，或使用 SVG 渲染替代
- **优先级**: P1

### PENDING-002: 生图多张是否真的不同
- **状态**: 已修复文件名覆盖问题，但需验证 MiniMax API 对相似 prompt 是否返回不同图片
- **优先级**: P0（下次测试验证）

### PENDING-003: ErrorBoundary 生产移除
- **状态**: CanvasPage 已加 ErrorBoundary 用于调试，生产前应移除或改为用户友好提示
- **优先级**: P2

---

## 本次新增功能

### DeletableEdge — 连线交互增强
- 自定义边组件，替代 React Flow 默认边
- hover 高亮（蓝色），20px 宽透明命中区域
- 选中后中点显示红色 − 按钮，点击删除
- Delete/Backspace 键批量删除选中连线
- `canvasStore.selectedEdgeIds` 追踪边选中状态

### NodeBase PortDef 增强
- `PortDef` 新增 `removable?: boolean` + `onRemove?: (id: string) => void`
- 底部 port 标签 hover 时圆点变红色 − 删除按钮
- 无 label 的 output 不再占据底部栏空间

### Image List 改进
- 动态 input 最多 3 个（`MAX_IMAGE_INPUTS = 3`）
- Input hover 显示 − 删除按钮
- Output 不显示底部标签和预览网格
- done 状态文字提示替代图片网格
