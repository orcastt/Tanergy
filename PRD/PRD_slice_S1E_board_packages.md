# PRD Slice S1E: Tanergy Board Package Export And Import

**Updated**: 2026-05-08
**Status**: Planned product slice. The Board document and Asset foundations exist, but user-facing `.tgy` export/import is not implemented yet.

## Product Goal

Let a user export a complete Board as a reusable Tanergy Board Package file with the `.tgy` extension, then import that package later or share it with another user/team.

This is a file-based sharing and reuse path. It complements server share links, but does not replace permissioned online sharing.

## User Value

- Save a complete creative workflow locally as one file.
- Reuse a Board as a template.
- Send a Board to another collaborator without requiring an online share link.
- Preserve canvas drawings, images, AI nodes, prompts, model parameters and node connections.
- Re-import the same package multiple times to create independent Board copies.

## File Format

User-facing extension:

```text
.tgy
```

Product label:

```text
Tanergy Board Package
```

Implementation detail: a `.tgy` file is a zip-compatible package. Users should not need to think about zip internals.

Package contents:

```text
manifest.json
board.json
assets/
  <asset-id-or-hash>.<ext>
thumbnails/
  board-preview.png
```

## Export Requirements

Export must include:

- Current Board metadata needed for a portable copy: title, description, renderer and schema version.
- Konva Board document: pages, active page, camera, canvas settings and shape data.
- Canvas drawings: strokes, lines, arrows, shapes, frames, text and sticky notes.
- AI workflow data: Prompt, Prompt Optimizer, Analysis, Chat, Image, Image Gen and Image Gen 4 nodes.
- Node runtime edges and port connections.
- Model and parameter selections stored in node data.
- Image assets used by image shapes and image-bearing nodes.
- AI generated output images that are represented as Board assets.
- Board preview thumbnail when available.

Export must not include:

- API keys or provider secrets.
- Raw provider responses, long logs or private billing/admin data.
- User auth/session tokens.
- Data URL, blob URL or Base64 image payloads inside `board.json`.

## Import Requirements

Import must:

- Accept `.tgy` files from local disk.
- Validate `manifest.json` and `board.json` before creating a Board.
- Reject unsupported schema versions with a clear message.
- Re-upload packaged assets into the current workspace.
- Rewrite all asset ids and URLs inside the imported Board document.
- Create a new Board by default, so importing the same `.tgy` repeatedly creates independent copies.
- Preserve pages, shapes, drawings, nodes, prompts, model parameters and runtime edges.
- Preserve image crops and generated-output references where possible.
- Show a concise success/failure message with imported page, shape, edge and asset counts.

Import may later add an "overwrite current Board" mode, but the first version should always create a new Board.

## Permissions And Safety

- Export requires at least Board view access.
- Import creates a new Board owned by the current user/workspace context.
- Imported assets are new assets in the destination workspace, not references to another workspace's private asset records.
- The server/client guard must reject packages that contain unsafe URLs, `data:`, `blob:`, executable content or malformed JSON.
- Import must not preserve source owner ids, workspace ids, board member lists or share links.

## Acceptance

- User can export a Board containing drawings, images, AI nodes and runtime edges as a `.tgy` file.
- User can import that `.tgy` into the same workspace and receive a new Board with matching visual content and workflow structure.
- User can import the same `.tgy` multiple times without corrupting the original package or overwriting prior imports.
- User can import a `.tgy` from another workspace/user and images are rehydrated as destination-workspace assets.
- Import rejects a tampered package without creating a partial Board.
- Export/import passes the existing Board document guard.

## Deferred

- Asset hash dedupe across repeated imports.
- Import preview before creation.
- Partial import into the current Board.
- Package signing or marketplace trust metadata.
- Cross-version migration beyond the current Konva v2 Board document.
