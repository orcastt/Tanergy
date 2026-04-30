# Canvas Navigator Collapse Slice — 2026-04-30

## Goal

给左下角 navigator 增加折叠入口，让用户在密集画布或需要更多画布空间时，把小地图缩成一个图标，需要定位时再展开。

## Scope

- Navigator 默认保持展开。
- 展开态右上角增加 icon-only collapse 按钮。
- 折叠态只保留一个小图标按钮，点击后恢复完整 navigator。
- 折叠态不计算小地图 bounds / shape rects，减少高密度画布上的额外工作。
- 不改变 tldraw camera、document、shape 或 node runtime 数据。

## Files

- `apps/web/src/components/canvas/CanvasSpikeNavigator.tsx`
- `apps/web/src/app/styles/canvas-navigation.css`
- `project_state.md`

## Acceptance

1. 左下角 navigator 可以从展开态折叠成一个图标。
2. 点击折叠图标后可以恢复完整 navigator。
3. 展开态 zoom in / zoom out / 点击小地图跳转仍可用。
4. 折叠态不遮挡画布主要操作，也不触发画布选择或拖拽。
5. `lint` / `typecheck` / `build` / `git diff --check` 全通过。
