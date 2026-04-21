# Slice 8: Skill 模板 + 端到端测试

**优先级**: P0 | **难度**: 中 | **预计**: 3 天 | **状态**: ⬜ 未开始
**依赖**: Slice 7 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

---

## 目标

实现 Skills 系统（用户选择预置 Skill 自动生成工作流）和端到端测试。公众号长文创作 Skill 是 MVP 的核心用户入口。Pro 用户可使用 Skill 模板，Free 用户只能手动创建节点。

---

## 前端步骤

### Step 1: Skill 定义接口

**文件**: `frontend/src/skills/types.ts`

```typescript
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiredPlan: "free" | "pro";
  configFields: ConfigField[];
  generateGraph: (config: Record<string, string>) => GraphDefinition;
}

export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "select" | "number";
  required: boolean;
  defaultValue: string;
  options?: { label: string; value: string }[];
}

export interface GraphDefinition {
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
}
```

### Step 2: 公众号长文创作 Skill

**文件**: `frontend/src/skills/definitions/wechatArticle.ts`

```
wechatArticle 定义:
  id: "wechat_article"
  name: "公众号长文创作"
  description: "从选题到成稿，自动生成公众号格式长文"
  icon: "📝"
  requiredPlan: "free"

  configFields:
    - key: "topic", label: "主题关键词", type: "text", required: true
    - key: "style", label: "文章风格", type: "select",
      options: [
        { label: "深度解析", value: "deep_analysis" },
        { label: "轻松科普", value: "light_science" },
        { label: "情感共鸣", value: "emotional" },
        { label: "干货清单", value: "checklist" },
      ],
      defaultValue: "checklist"
    - key: "imageCount", label: "配图数量", type: "select",
      options: [{label:"1",value:"1"},{label:"3",value:"3"},{label:"5",value:"5"}],
      defaultValue: "3"
    - key: "imageStyle", label: "配图风格", type: "select",
      options: [{label:"写实",value:"realistic"},{label:"插画",value:"illustration"},{label:"简约",value:"minimal"}],
      defaultValue: "realistic"

  generateGraph(config):
    返回 11 节点工作流:

    节点:
      1. text_input (id: "topic_1")
         - position: (0, 0)
         - data: { text: config.topic }

      2. research (id: "research_1")
         - position: (300, 0)
         - data: { searchRounds: 2, resultCount: 10 }

      3. outline_generator (id: "outline_1")
         - position: (600, 0)
         - data: { style: config.style }

      4. gate (id: "gate_1")
         - position: (900, 0)
         - data: {}

      5. writer (id: "writer_1")
         - position: (1200, 0)
         - data: { targetLength: "3000-5000" }

      6. reviewer (id: "reviewer_1")
         - position: (1500, 0)
         - data: {}

      7. image_planner (id: "img_planner_1")
         - position: (1500, 250)
         - data: { imageCount: config.imageCount, imageStyle: config.imageStyle }

      8. image_gen (id: "img_gen_1")
         - position: (1800, 250)
         - data: { concurrency: 2 }

      9. html_formatter (id: "html_fmt_1")
         - position: (1800, 0)
         - data: { style: "经典", fontSize: 16, lineHeight: 1.75 }

      10. preview_wechat (id: "preview_1")
          - position: (2100, 0)
          - data: {}

      11. image_gallery (id: "gallery_1")
          - position: (2100, 250)
          - data: {}

    边:
      topic_1[text] → research_1[text]
      research_1[research_result] → outline_1[research_result]
      topic_1[text] → outline_1[text]
      outline_1[outline_options] → gate_1[outline_options]
      gate_1[outline_options] → writer_1[outline_options]
      writer_1[text] → reviewer_1[text]
      reviewer_1[text] → img_planner_1[text]
      img_planner_1[image_plans] → img_gen_1[image_plans]
      img_gen_1[image_slot] → gallery_1[image_slot]
      img_gen_1[image_slot] → html_fmt_1[image_slot]
      reviewer_1[text] → html_fmt_1[text]
      html_fmt_1[structured] → preview_1[structured]

    dagre 自动布局:
      - direction: "LR"
      - nodeSpacing: 80
      - rankSpacing: 300
```

### Step 3: Skill 注册表

**文件**: `frontend/src/skills/index.ts`

```typescript
import { SkillDefinition } from "./types";
import { wechatArticle } from "./definitions/wechatArticle";

export const SKILLS: SkillDefinition[] = [
  wechatArticle,
  // Phase 2: 小红书图文笔记、视频脚本等
];

export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}
```

### Step 4: SkillPanel 组件

**文件**: `frontend/src/skills/SkillPanel.tsx`

```
位置: 从左侧滑入，覆盖工具栏区域
宽度: 320px
触发: 工具栏/顶栏 Skills 按钮

布局:
  ┌─────────────────────────────────┐
  │ Skills (Cal Sans 24px 600)  [×] │
  ├─────────────────────────────────┤
  │                                 │
  │  ┌─────────────────────────┐    │
  │  │ 📝 公众号长文创作       │    │  ← 卡片样式
  │  │ 从选题到成稿...         │    │     card shadow
  │  │                    [→]  │    │
  │  └─────────────────────────┘    │
  │                                 │
  │  更多 Skills 即将推出...         │
  │                                 │
  └─────────────────────────────────┘

动画:
  - 滑入: translateX(-320px) → translateX(0), 200ms

逻辑:
  - 点击卡片 → SkillConfigModal
  - Free 用户可用（requiredPlan: "free"）
  - 后续 Pro 专属 Skill 显示锁定标记
```

### Step 5: SkillConfigModal 组件

**文件**: `frontend/src/skills/SkillConfigModal.tsx`

```
使用 Radix UI Dialog

布局:
  ┌──────────────────────────────────────┐
  │ 📝 公众号长文创作                    │  ← Cal Sans 24px 600
  │ 从选题到成稿，自动生成公众号格式长文  │
  ├──────────────────────────────────────┤
  │                                      │
  │ 主题关键词 *                         │
  │ [________________________]           │
  │                                      │
  │ 文章风格                             │
  │ [深度解析] [轻松科普] [情感共鸣] [干货]│  ← 药丸按钮组
  │                                      │
  │ 配图数量                             │
  │ [1] [3] [5]                          │
  │                                      │
  │ 配图风格                             │
  │ [写实] [插画] [简约]                  │
  │                                      │
  ├──────────────────────────────────────┤
  │                  [取消] [生成工作流 ▶]│
  └──────────────────────────────────────┘

样式:
  - 白底, 16px 圆角, panel 阴影
  - 宽度 520px

提交:
  1. 校验 required 字段
  2. skill.generateGraph(configValues)
  3. applySkill(graphDefinition)
  4. 关闭 Modal
```

### Step 6: useSkillApply Hook

**文件**: `frontend/src/skills/hooks/useSkillApply.ts`

```typescript
function useSkillApply() {
  async function applySkill(graph: GraphDefinition) {
    // 1. 清空画布（如有节点，提示用户确认）
    if (canvasStore.getState().nodes.length > 0) {
      const confirmed = window.confirm("当前画布有内容，是否替换？");
      if (!confirmed) return;
      canvasStore.getState().setGraphFromJson({ nodes: [], edges: [] });
    }

    // 2. 节点逐个出现动画 (1.5s)
    const sorted = topologicalSort(graph.nodes, graph.edges);
    const delayPerNode = 1500 / sorted.length;

    for (const nodeId of sorted) {
      const node = graph.nodes.find((n) => n.id === nodeId);
      const nodeEdges = graph.edges.filter(
        (e) => e.source === nodeId || e.target === nodeId
      );

      await sleep(delayPerNode);
      canvasStore.getState().addNode(node);
      nodeEdges.forEach((edge) => canvasStore.getState().addEdge(edge));
    }

    // 3. 居中显示
    reactFlowInstance.fitView({ padding: 0.2, duration: 500 });

    // 4. toast
    toast.success("工作流已生成，你可以调整任意节点参数");

    // 5. 标记 dirty
    workflowStore.getState().markDirty();
  }

  return { applySkill };
}
```

### Step 7: dagre 自动布局

**文件**: `frontend/src/lib/layoutUtils.ts`

```
安装依赖: npm install dagre @types/dagre

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "LR" | "TB" = "LR"
): { nodes: Node[]; edges: Edge[] }
  - nodeWidth: 280
  - nodeHeight: 估算（按节点类型）
  - rankSpacing: 300
  - nodeSpacing: 80
  - 返回带新 position 的 nodes 和 edges
```

---

## 端到端测试

### Step 8: 手动端到端测试流程

```
测试用例: 公众号长文创作完整流程

前置条件:
  - Anthropic API Key 已配置且有效
  - Tavily API Key 已配置且有效
  - Google Cloud API Key 已配置且有效
  - License 已激活（Pro 或试用期内）

步骤:
  1. 启动应用 → Dashboard
  2. 点击 "新建工作流" → 进入空白画布
  3. 点击工具栏 "Skills" → SkillPanel 打开
  4. 点击 "公众号长文创作" → SkillConfigModal 打开
  5. 输入主题 "人工智能在教育领域的应用"
  6. 选择风格 "深度解析"
  7. 配图数量 3，风格 "写实"
  8. 点击 "生成工作流"
  9. 验证: 11 个节点逐个出现，连线正确
  10. 点击 "Run All"
  11. 验证: text_input → research → outline_generator 依次执行
  12. 验证: outline_generator 生成 3 个大纲选项
  13. 验证: Gate 节点 waiting，显示 3 个临时选项节点
  14. 点击第 2 个选项
  15. 验证: writer → reviewer → image_planner 依次执行
  16. 验证: reviewer 输出 ≥2000 字审校文章
  17. 验证: image_planner 规划 3 张配图
  18. 验证: image_gen 调用 Imagen 3 生成 3 张图
  19. 验证: image_gallery 展示 3 张图片
  20. 验证: html_formatter 生成 HTML
  21. 验证: preview_wechat 模拟手机预览
  22. 点击 "复制到剪贴板"
  23. 验证: 复制成功 toast
  24. Cmd+S 保存
  25. 验证: toast "已保存"
  26. 返回 Dashboard
  27. 验证: 工作流卡片显示
  28. 重启应用
  29. 打开工作流
  30. 验证: 节点和结果保持
```

### Step 9: 自动化测试补充

**文件**: `src-tauri/tests/commands_test.rs`

```rust
// Rust 侧单元测试:
// - test_execute_text_input: 透传
// - test_execute_research_no_key: 返回 "Tavily API Key 未配置"
// - test_execute_outline_no_key: 返回 "Anthropic API Key 未配置"
// - test_license_verify_valid: 有效签名
// - test_license_verify_invalid: 无效签名
// - test_api_key_encrypt_decrypt: 加解密往返
```

**文件**: `frontend/src/__tests__/` — 可选

```typescript
// 前端侧单元测试 (vitest):
// - dagUtils.test.ts: 拓扑排序、层级计算、环检测
// - nodeDefs.test.ts: 端口类型匹配
// - skillDefinition.test.ts: generateGraph 输出正确节点数
// - canvasStore.test.ts: addNode/removeNode/undo/redo
```

---

## 验收清单

- [ ] SkillPanel 从左侧滑入，显示公众号 Skill 卡片
- [ ] 点击 Skill 卡片打开配置弹窗
- [ ] 配置弹单动态渲染表单，药丸按钮组正常
- [ ] 必填字段为空时 "生成工作流" 按钮置灰
- [ ] 生成工作流: 11 个节点逐个出现动画
- [ ] 节点和连线正确（与 Skill 定义一致）
- [ ] 生成后 fitView 居中 + toast 提示
- [ ] 手动 Run All: text_input → research → outline 完整执行
- [ ] Gate waiting 时显示临时选项节点
- [ ] 选择后 writer → reviewer → image_planner → image_gen 链路跑通
- [ ] html_formatter → preview_wechat 链路跑通
- [ ] "复制到剪贴板" 复制带内联样式的 HTML
- [ ] Cmd+S 保存 + 重启后数据保持
- [ ] dagre 自动布局正确（无节点重叠）
- [ ] Rust 侧单元测试通过
- [ ] 前端侧单元测试通过（可选）
- [ ] 所有文件 < 300 行

---

## 完成后更新

- [ ] 本文件状态 → ✅
- [ ] project_state.md → Slice 9
- [ ] phase1-mvp.md → Slice 8 ✅
- [ ] git commit: "Slice 8: Skill template (WeChat article) + e2e test"
