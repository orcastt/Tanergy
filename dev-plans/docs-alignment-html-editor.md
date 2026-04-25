# Docs Alignment + Html Editor 收口

**日期**: 2026-04-25  
**状态**: ✅ 已执行（构建通过，待手测验收）  
**范围**: 主文档、`dev-plans/`、`debug-plans/`、README、Html Editor 阻断修复

---

## 统一口径

当前公众号主流程以 `html_formatter` / Html Editor 作为终点：

```
text_input → research → outline_generator → Split
  → N × text_input(section)
  → image_list
  → html_formatter / Html Editor
```

`preview_wechat` 保留为历史/legacy 预览能力，不再作为默认主流程出口。

---

## 已完成索引

| 模块 | 状态 | 文件 |
|------|------|------|
| Html Editor 入口 | ✅ | `frontend/src/nodes/HtmlFormatterNode.tsx`, `frontend/src/store/overlayStore.ts`, `frontend/src/canvas/Canvas.tsx` |
| 富文本编辑器 | ✅ | `frontend/src/nodes/image/TiptapEditor.tsx` |
| 双栏编辑/预览 Modal | ✅ | `frontend/src/nodes/image/HtmlEditorModal.tsx`, `frontend/src/nodes/image/WeChatPreview.tsx` |
| AI 改写弹窗 | ✅ | `frontend/src/nodes/image/HtmlRewritePopup.tsx`, `src-tauri/src/commands/asset.rs` |
| 端口契约 | ✅ | `frontend/src/nodes/nodeDefs.ts`, `frontend/src/nodes/OutlineGeneratorNode.tsx` |
| 构建阻断修复 | ✅ | `frontend/src/canvas/DeletableEdge.tsx`, `frontend/src/nodes/image/*`, `frontend/src/store/canvasActions.ts` |

---

## 本轮修复

- 修复 `npm -C frontend run build` 的 TypeScript 阻断。
- `outline_generator.image_plans` 统一为真实 `image_plans` 类型。
- `html_formatter` 保持 terminal output：运行完成后双击进入 Html Editor。
- Html Editor 编辑内容实时写回 `nodeResults`，关闭时写入节点 `data.editedHtml`，同一工作流会话内关闭再打开不丢内容。
- `dev-plans/` 与 `debug-plans/` 标注历史链路和当前主链路，避免继续把 `preview_wechat` 当默认出口。

---

## 验收清单

- [x] `npm -C frontend run build` 通过。
- [ ] 手测：`html_formatter` 执行完成后双击打开 Html Editor。
- [ ] 手测：编辑内容后右侧微信预览实时更新。
- [ ] 手测：关闭 Html Editor 后重新打开，编辑内容仍保留。
- [ ] 手测：Outline Split 自动生成章节节点、`image_list`、`html_formatter` 并正确连线。

---

## 后续事项

- 端到端跑通官方 API / 用户自带 Key 两种执行路径。
- Admin Dashboard 基础前端已实现，下一步是接口联调、鉴权验收和部署。
- 生产前恢复或重做 `AuthGuard` 登录门控，当前本地测试仍是 bypass 状态。
