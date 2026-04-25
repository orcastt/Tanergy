# Code Quality Standards — Frontend / Tauri

**日期**: 2026-04-25  
**状态**: ✅ 生效  
**范围**: `frontend/` React + TypeScript、React Flow 节点、Html Editor / Image Editor、Tauri IPC 调用边界

---

## 背景

本规范来自 2026-04-25 自动检查暴露的问题：

- `npm -C frontend run build` 可以通过，但全量 `npm -C frontend run lint` 仍有历史债。
- 本轮改动相关文件已做到定向 lint 清零。
- 后续开发原则：**不要求一次性清完历史 lint，但任何新开发/测试调整不能新增 lint 问题。**

---

## 必跑检查

### 每次改前端功能

从仓库根目录执行：

```bash
npm -C frontend run build
git diff --check
```

从 `frontend/` 目录对触碰文件执行定向 lint：

```bash
npx eslint src/path/to/changed-file.tsx src/path/to/changed-file.ts
```

### 每次改 Rust / Tauri 命令

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

### 全量 lint 当前策略

```bash
npm -C frontend run lint
```

- 当前全量 lint 仍包含历史问题，不作为每次提交的阻断门槛。
- 但**触碰文件必须定向 lint 通过**。
- 如果一个文件本来有历史 lint，修改该文件时要优先清掉该文件里的 lint，除非范围明显过大并在提交说明中标记。

---

## TypeScript 规范

1. **禁止新增 `any`**
   - 优先使用 `unknown` + 类型收窄。
   - React Flow 画布使用官方类型：`Node`、`Edge`、`Connection`、`NodeMouseHandler`、`OnNodeDrag`、`NodeTypes`。
   - Store / IPC 边界使用 `Record<string, unknown>`。

2. **节点数据必须显式建模**
   - 节点组件里为 `data` 定义本地 interface。
   - 读取 `nodeResults` 时必须按实际输出类型断言，并对可选字段做兜底。

3. **不要用 eslint-disable 遮问题**
   - 只有第三方类型确实无法表达时才允许。
   - 必须写明原因，并尽量限制到单行。

---

## React Hooks 规范

1. **所有 Hook 必须在 early return 之前调用**

错误模式：

```tsx
const def = NODE_MAP[d.nodeType]
if (!def) return null
const { t } = useTranslation()
```

正确模式：

```tsx
const def = NODE_MAP[d.nodeType]
const { t } = useTranslation()
if (!def) return null
```

2. **不要在 `useEffect` 里同步做 prop → state 镜像**

优先方案：

- 用 `useMemo` 派生值。
- 用 `key` 让组件在实体切换时重新挂载。
- 只在订阅、异步回调、外部系统同步时使用 effect。

3. **数组/对象 fallback 要稳定**

如果 fallback 会进入 dependency array，必须用 `useMemo` 或模块级常量稳定引用：

```tsx
const imageInputs = useMemo(() => d.imageInputs ?? ["img_in_1"], [d.imageInputs])
```

4. **不要修改 Hook / Store 返回的对象**

错误：

```ts
currentWorkflow!.name = nameDraft
```

正确：

```ts
updateWorkflowName(currentWorkflow.id, nameDraft)
```

---

## React Flow 节点与端口规范

1. **`NODE_DEFS` 是端口契约源头**
   - 静态端口必须先登记在 `frontend/src/nodes/nodeDefs.ts`。
   - `PortType` 必须来自 `frontend/src/types/node.ts`。
   - 连线只允许同类型端口相连。

2. **动态端口命名必须稳定**
   - `html_formatter` 文本输入：`text_1`、`text_2`、...
   - `html_formatter` 图片输入：`images`、`image_2`、...
   - `image_list` 图片输入：`img_in_1`、`img_in_2`、...
   - 默认上限：`MAX_AUTO_INPUTS = 10`。

3. **自动扩展输入端口由 Canvas 统一处理**
   - 多条线连到已占用 input 时，`Canvas.resolveAutoInputExpansion()` 负责创建下一个端口并改写连接目标。
   - 节点组件只负责渲染端口和手动 add/remove UI。

4. **节点 UI 不直接破坏执行契约**
   - 删除动态端口时只更新节点 `data`，不要在组件里直接改 `edges`。
   - 执行引擎从 `edges + nodeResults` 聚合输入，组件不要重复实现执行逻辑。

---

## 执行引擎与 Mock 规范

1. **输入数据统一走 `input_data`**
   - `text_input` 必须支持手动文本和上游 `in` 输入。
   - 上游对象字段兼容顺序：`text`、`content`、原始字符串。

2. **Split 章节输出必须可追溯**
   - `outline_generator.section_N` 需要能回落到 `sections[index]`。
   - 不允许因为 handle-specific 输出缺失导致下游 Text 节点空跑爆红。

3. **Mock 模式也要遵守真实数据契约**
   - Mock 输出字段名必须贴近真实执行输出。
   - 不用“只为 UI 展示”的临时字段绕过执行引擎。

---

## Html Editor 规范

1. **`html_formatter` 是公众号默认终点**
   - `preview_wechat` 仅 legacy，不再作为默认主流程出口。
   - 执行完成后由 `HtmlFormatterNode` 双击进入 Html Editor。

2. **编辑保存闭环**
   - 编辑中实时写回 `nodeResults[nodeId].html`。
   - 关闭时写入 `node.data.editedHtml`。
   - 关闭后重开不能丢失内容。

3. **预览与复制统一样式**
   - 右侧预览使用完整页面预览，不使用手机壳 mock。
   - 标准紫样式通过 `toStandardPurpleHtml()` 统一转换。
   - “复制 HTML”复制的是标准紫 inline style HTML。

---

## 文档同步规范

涉及以下变更时必须同步文档：

- 主流程节点变化：更新 `project_state.md`、`dev-plans/node-plan.md`、`README.md`。
- Html Editor / Image Editor 行为变化：更新对应 slice 文档和 `frontend/README.md`。
- 测试策略或质量门槛变化：更新本文档与 `project_state.md`。
- legacy 节点重新启用或废弃：必须明确是否进入默认公众号模板。

---

## Definition of Done

一次前端功能调整完成前，至少满足：

- [ ] 触碰文件定向 `npx eslint ...` 通过。
- [ ] `npm -C frontend run build` 通过。
- [ ] `git diff --check` 通过。
- [ ] 如果改 Rust：`cargo check --manifest-path src-tauri/Cargo.toml` 通过。
- [ ] 如果改节点端口：手测连线、动态端口、执行输入聚合。
- [ ] 如果改 Html Editor：手测双击打开、实时预览、关闭重开、复制 HTML。
- [ ] 如果改主流程：同步 `project_state.md` / `README.md` / 对应 `dev-plans`。
