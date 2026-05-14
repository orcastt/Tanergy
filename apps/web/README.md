# TANGENT Web App

Fresh Web AI Image Canvas implementation starts here.

## Current Canvas

Run the app:

```bash
npm -C apps/web run dev
```

Open:

```text
http://localhost:3000/boards/<boardId>
```

The active canvas surface is now the Konva runtime on `/boards/[boardId]`:
pan/zoom, drawing, shapes, sticky notes, frames, image objects, arrows, pages,
node cards, share view, save/history, and collaboration scaffolding all validate
there. `/spikes/konva-canvas` remains a dev-only regression harness.

Next gate: keep tightening the production Konva canvas while finishing the
remaining AI/provider and collaboration hardening:

1. Node Runtime / Node Registry
2. Image Gen / Image Gen 4 nodes with model params
3. Dynamic image input ports
4. Text/image colored ports and connection rules
5. Left-side Inspector
6. Mock planner auto-layout
7. Merge Capture export
8. 50-100 node pressure test

P0 scope:

1. Miro-like canvas base
2. Konva-only production canvas
3. Prompt Node
4. Image Gen Node (1 image)
5. Image Gen 4 Node (4 images)
6. Analysis Node
7. Image Node
8. Send to Canvas
9. Merge Capture to New Image Node
10. AI Chat auto wiring

Do not import legacy desktop/admin/frontend modules into this app. If a legacy idea is useful, extract the smallest concept and reimplement it cleanly.
