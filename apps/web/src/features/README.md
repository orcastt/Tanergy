# Features

Feature folders own product contracts, hooks, client adapters and renderer-neutral logic.

Active feature slices:

- `admin`: server-gated admin client contracts and role-management helpers.
- `ai`: model registry and mock AiRun client contracts.
- `assets`: Asset upload/import, thumbnails and storage-facing helpers.
- `auth`: Clerk/session bridge and request-context client helpers.
- `billing`: personal billing, entitlement and payer-summary contracts.
- `boards`: Board document contracts, metadata, history, save/load and engine detection.
- `canvas-engine`: renderer-neutral CanvasDocument, geometry and shape contracts.
- `canvas-settings`: Board canvas background/snap/settings state.
- `node-runtime`: Node Registry, runtime graph, mock dataflow and asset reference resolution.
- `smart-drawing`: local stroke recognition and shape fitting.

Do not add provider calls, raw image payloads or long generated logs to feature state that can be serialized into Board documents.
