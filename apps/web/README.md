# TANGENT Web App

Fresh Web AI Image Canvas implementation starts here.

## Current Spike

Run the app:

```bash
npm -C apps/web run dev
```

Open:

```text
http://localhost:3000/spikes/canvas
```

This Step 1 spike validates tldraw as the whiteboard base: pan/zoom, drawing, shapes,
sticky notes, frames, image objects, mock link cards, arrows, and Prompt / Generate /
Edit AI node cards. Step 1.5 now validates real `node_card` prototypes for Prompt,
Image Gen, Image Gen 4, Analysis, and Image.

Next gate: Step 1.5 validates complex AI nodes before formal feature work:

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
2. Step 1.5 architecture gate
3. Prompt Node
4. Image Gen Node (1 image)
5. Image Gen 4 Node (4 images)
6. Analysis Node
7. Image Node
8. Send to Canvas
9. Merge Capture to New Image Node
10. AI Chat auto wiring

Do not import legacy desktop/admin/frontend modules into this app. If a legacy idea is useful, extract the smallest concept and reimplement it cleanly.
