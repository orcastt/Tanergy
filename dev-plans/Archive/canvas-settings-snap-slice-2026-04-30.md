# Canvas Settings and Snap Alignment Slice — 2026-04-30

## Goal

给 S1.5 画布补齐可调设置面板，并开启对齐吸附能力。

## Scope

- 新增画布 Settings 面板入口。
- 控制 Grid Rendering、Grid Style、Grid Unit、Grid Color。
- 控制 Snap Alignment，并允许用户设置 snap distance / threshold。
- 控制 Zoom Sensitivity。
- 保留 Edge Color 和 AI Chat Style 设置项，为后续节点线和右侧 Chat 做配置入口。
- 设置可保存到 localStorage，刷新后恢复。

## Non-goals

- 不做完整账户级设置页。
- 不接后端保存用户偏好。
- 不做多人协作偏好同步。
- 不重做 tldraw 原生选择/拖拽工具。

## Acceptance

1. Settings 面板从画布内齿轮入口打开，能关闭。
2. 打开 Snap Alignment 后，拖动对象时 tldraw 原生对齐吸附生效。
3. Snap Distance 调大后吸附距离更宽，调小后更严格。
4. Grid Rendering 可开关，Grid Unit 改变网格大小。
5. Grid Color / Style 能影响网格视觉。
6. Zoom Sensitivity 改变滚轮缩放手感。
7. Save Settings 后刷新页面保留设置。

## Implemented

- 新增 `canvasSettingsStore` 管理本地画布偏好，`Save Settings` 写入 localStorage。
- 新增画布内齿轮入口和 Settings 面板，UI 对齐参考图的左侧导航 + 右侧设置布局。
- 使用 tldraw 原生 `isSnapMode` 开启对象对齐吸附。
- 使用 tldraw `snapThreshold` 作为可调 Snap Distance。
- 使用 tldraw document settings 控制 Grid Unit / Grid Rendering。
- 使用 tldraw camera options 控制 Zoom Sensitivity。
- 新增自定义 Grid 组件支持 Solid / Grid 视觉和 Grid Color。

## Open Polish

- ~~用户手测确认吸附对齐可用，但红色对齐轴线太深；下一班次把 snap guide 视觉降到约 20% opacity。~~ GLM 2026-04-30 已在 `canvas-shell.css` 中覆盖 `.tl-snap-indicator` 和 `.tl-snap-point` opacity 为 0.2。等待手测确认。
- 只改 snap guide，不要改变普通红色 shape / error / destructive UI。（已确认只覆盖 snap 相关类）
