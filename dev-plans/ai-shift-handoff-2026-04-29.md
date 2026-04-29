# AI Shift Handoff — 2026-04-29 S1.5 Node Runtime

**Purpose**: Half-day handoff plan for another AI assistant temporarily taking over while Codex is unavailable.  
**Current branch**: `checkpoint/s15-node-runtime-before-refactor`  
**Latest commits**:

```text
709297f refactor: split oversized canvas files
4315fae feat: checkpoint web canvas node runtime
50edc22 chore: restart web image canvas
```

**Primary rule**: The next AI is a temporary shift engineer, not a product owner. It should preserve the current direction, avoid broad rewrites, and only make small, testable changes.

---

## 1. Current Project State

TANGENT is now a Web-first AI image canvas. The current active demo is:

```text
http://localhost:3000/spikes/canvas
```

The active architecture direction is:

```text
Prompt Node → Image Gen / Image Gen 4 → Image Node
Image Node + Prompt Node → Image Gen / Analysis
Canvas Markup → Merge Capture → New Image Node
Right AI Chat later creates and wires these nodes automatically
```

Current S1.5 implementation includes:

- tldraw-based canvas spike.
- Custom `node_card` shape.
- Five node prototypes: Prompt, Image Gen, Image Gen 4, Analysis, Image.
- Left-side Node Inspector.
- Text/image typed ports and colored connections.
- Dynamic image input ports for Image Gen / Image Gen 4.
- Node-node connection validation and invalid-line deletion.
- Mid-line `−` disconnect button.
- Mock graph insertion and 60-node stress insertion.
- Merge Capture local preview.
- Source files split to keep every source file under 300 lines.

---

## 2. Must-Read Files for Next AI

Read these first, in this order:

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `dev-plans/web-alpha-detailed-development-plan.md`
5. `dev-plans/web-collaborative-canvas-pivot.md`
6. This file: `dev-plans/ai-shift-handoff-2026-04-29.md`

Do not read or modify:

- `.env`
- `legacy/old-tangent-desktop-2026-04-29/` unless explicitly asked
- old archived pivot docs as canonical source

---

## 3. Codex Working Skills / Operating Style to Preserve

The next AI may not have the same Codex tool stack, so follow these behavior-level equivalents.

### 3.1 Planning Skill

- Before a non-trivial edit, state a short plan.
- Keep one active step at a time.
- Do not start a large refactor without a checkpoint commit.
- If task scope expands, update `dev-plans/` or add a `debug-plans/` note before coding.

### 3.2 Code Search Skill

- Use `rg` for text search and `rg --files` / `find` for file discovery.
- Do not rely on memory for file names or current architecture.
- Do not dump giant files into the response; inspect only needed ranges.

### 3.3 Patch Skill

- Prefer small patches.
- Keep files single-purpose.
- Do not mix UI behavior, persistence, provider API calls, and styling in one file.
- If a file approaches 250 lines, plan a split before adding more logic.

### 3.4 Validation Skill

Run, at minimum, after code changes:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

Also check source file sizes:

```bash
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0 \
  | xargs -0 wc -l \
  | awk '$2 != "total" && $1 > 300 {print}' \
  | sort -nr
```

Expected output: empty.

### 3.5 Documentation Skill

- If behavior changes, update `project_state.md`.
- If scope or architecture changes, update `ARCH.md` and `PRD.md`.
- If a test session finds issues, create or update a focused note under `debug-plans/`.

### 3.6 Commit Skill

Current user preference:

- Before large fixes or stage transitions, create/switch branch and commit the current stable snapshot.
- Do not commit after every tiny patch unless user asks.
- If a temporary AI finishes a clean, tested slice, ask the user whether to commit.
- Never push unless explicitly requested.

---

## 4. GLM5.1 Capability Assumption and Guardrails

This is an operational assessment, not a benchmark claim.

Assume GLM5.1 is capable of:

- Reading project docs and following explicit step-by-step checklists.
- Making bounded TypeScript / React / CSS changes.
- Running local validation commands.
- Updating Markdown project plans.

Do not assume it will safely infer unstated architecture constraints. Therefore every task should be explicit, narrow, and externally verifiable.

Recommended guardrails for GLM5.1:

1. **No broad rewrites**: do not replace tldraw, do not rewrite the canvas shell, do not introduce React Flow/Konva unless user explicitly starts a new architecture decision.
2. **No backend/API work today**: do not touch real AI provider calls, credits, auth, or `.env`.
3. **No dependency additions** unless the user explicitly approves.
4. **No legacy archaeology** unless the user asks for a specific old behavior.
5. **No visual polish rabbit holes**: only fix blockers that break S1.5 validation.
6. **One defect per patch** when possible.
7. **Explain exact changed files** after each fix.
8. **Ask the user to hand-test UI interactions** that cannot be verified from CLI.

---

## 5. Half-Day Execution Plan for Next AI

### Round 0 — Safety and Context Check

Goal: Confirm it is on the correct branch and the repo is clean before touching anything.

Commands:

```bash
git branch --show-current
git status --short
git log --oneline -5
```

Expected:

- Branch should be `checkpoint/s15-node-runtime-before-refactor` or a new branch created from it.
- Latest commit should include `709297f refactor: split oversized canvas files`.
- Worktree should be clean before starting.

If dirty:

- Stop and ask the user whether those changes are intentional.
- Do not overwrite or reset user changes.

---

### Round 1 — Baseline Verification

Goal: Prove the current code still builds before changing it.

Commands:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

If any fail:

1. Fix only the failing issue.
2. Do not begin new feature work.
3. Re-run the failing command plus `git diff --check`.
4. Record the fix in the final response.

---

### Round 2 — S1.5 Manual Test Session

Goal: Collect real product feedback before coding more.

Start dev server:

```bash
npm -C apps/web run dev
```

Open:

```text
http://localhost:3000/spikes/canvas
```

User should hand-test and report findings. GLM should guide the user through this checklist.

#### 2.1 Node Creation

- Insert Prompt node.
- Insert Image Gen node.
- Insert Image Gen 4 node.
- Insert Analysis node.
- Insert Image node.
- Insert S1.5 graph.
- Insert 60 node stress.

Pass criteria:

- Nodes appear near current viewport.
- Nodes are selectable, draggable, copyable, deletable.
- No node opens unwanted tldraw default UI.
- Left Inspector appears when a node is selected.

#### 2.2 Node Internal Interaction

Test:

- Prompt textarea click / type / scroll.
- Image Gen model select.
- Image Gen aspect ratio select.
- Image Gen resolution select.
- Image Gen `Run mock`.
- Image Gen 4 `Run mock`.
- Analysis prompt textarea.
- Analysis `Run analysis mock`.

Pass criteria:

- Node internal interactions do not pan, zoom, select, or drag the canvas by accident.
- Mock run updates status and result placeholders.
- Result count is correct: Image Gen = 1, Image Gen 4 = 4.

#### 2.3 Port and Connection Rules

Legal connections:

- Prompt text out → Image Gen text in.
- Prompt text out → Image Gen 4 text in.
- Image image out → Image Gen image in.
- Image image out → Image Gen 4 image in.
- Image image out → Analysis image in.
- Analysis text out → Prompt text in.
- Analysis text out → Image Gen text in.

Pass criteria:

- Text ports/lines are yellow.
- Image ports/lines are green.
- Legal connections remain.
- Invalid type mismatch connections auto-delete and show light feedback.

#### 2.4 Dynamic Image Input Ports

Test:

1. Connect Image Node to Image Gen image input 1.
2. Confirm a new empty image input 2 appears.
3. Connect another Image Node to image input 2.
4. Confirm image input 3 appears.
5. Move nodes around.
6. Zoom 50%, 100%, 200%.

Pass criteria:

- Old image lines do not jump to wrong ports.
- New ports appear in stable positions.
- Maximum visible image inputs should not exceed 6.

#### 2.5 Disconnect Button

Test:

- Hover near a node-node line.
- Confirm midpoint `−` appears.
- Click `−`.

Pass criteria:

- Connection is removed.
- Other lines remain untouched.
- Button does not block canvas operations when not near a line.

#### 2.6 Merge Capture

Test:

- Select a shape/image/card with drawings.
- Use Merge Capture local preview.

Pass criteria:

- Preview does not include UI, selection box, toolbar, or grid.
- Data URL remains local preview only; do not persist `data:` into document state.

#### 2.7 Stress and Browser Pressure

Test:

- Insert 60 node stress.
- Pan / zoom / drag a group.
- Paste 5-10 external images from browser/Pinterest.

Pass criteria:

- UI remains usable.
- Image upload limits still apply: PNG/JPEG/WebP, 3MB, long edge 1280px.
- If browser becomes sluggish, record exact image count, rough dimensions, and reproduction steps.

Output of Round 2:

- Create `debug-plans/s15-manual-test-2026-04-29.md` if any findings are found.
- Categorize each finding as:
  - P0 blocker
  - S1.5 blocker
  - polish backlog
  - user preference / later UI refinement

---

### Round 3 — Allowed Fixes During This Shift

Only fix issues that block S1.5 validation.

Allowed fixes:

1. Typecheck/build/lint failures.
2. Broken imports from recent file split.
3. Event propagation bugs inside node controls.
4. Dynamic port drift or incorrect port count.
5. Legal connection incorrectly deleted.
6. Invalid connection not deleted.
7. Text/image line color wrong.
8. Disconnect button unusable or always visible.
9. Source file accidentally exceeds 300 lines.
10. Documentation mismatch caused by the fix.

Not allowed without user approval:

1. Real AI API integration.
2. Backend auth / credits / provider work.
3. Switching canvas library.
4. Adding dependencies.
5. Reworking entire toolbar design.
6. Rewriting Node Runtime from scratch.
7. Large visual redesign.
8. Touching legacy archive.

Patch rules:

- One bug, one focused patch when possible.
- Keep touched source files under 300 lines.
- Prefer adding small helper files over growing existing files.
- If a file hits 250+ lines, think before adding more.

---

### Round 4 — Validation After Fixes

Run:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0 \
  | xargs -0 wc -l \
  | awk '$2 != "total" && $1 > 300 {print}' \
  | sort -nr
```

Expected:

- All npm commands pass.
- `git diff --check` is empty.
- File-size command prints nothing.

If validation fails after two attempts:

- Stop.
- Document current state and error output.
- Ask user whether to continue or wait for Codex.

---

### Round 5 — Handback to Codex

At the end of the GLM shift, it must produce a handback note with:

1. Current branch.
2. Latest commit hash if any commit was made.
3. Exact files changed.
4. Commands run and pass/fail results.
5. Manual test results.
6. Any unresolved blockers.
7. What the user still needs to test.
8. Whether it recommends a commit.

If it creates a debug plan, link it in `project_state.md`.

---

## 6. User Collaboration Instructions During GLM Shift

The user should help GLM in these ways:

1. Paste this handoff file into the GLM conversation first.
2. Ask GLM to repeat the safety constraints before coding.
3. Provide exact visual feedback:
   - what you clicked
   - what you expected
   - what happened
   - screenshot if possible
   - browser zoom level
   - canvas zoom level
4. Do not ask GLM to start real provider/API work today.
5. If GLM proposes broad rewrites, tell it to stop and return to this file.
6. If GLM makes a clean fix and all checks pass, ask it whether a checkpoint commit is appropriate.
7. Do not let it read `.env`.

Suggested initial prompt to GLM:

```text
先读 project_state.md、PRD.md、ARCH.md、dev-plans/web-alpha-detailed-development-plan.md、dev-plans/ai-shift-handoff-2026-04-29.md。你现在是临时接班工程师，只做 S1.5 手测和阻塞修复，不做大重构、不接真实 AI API、不读 .env、不碰 legacy。先检查 git 状态和当前分支，然后按 handoff 的 Round 0-2 做基线验证和手测清单。任何代码改动前先说明计划。
```

---

## 7. What Codex Should Verify When Returning

When Codex returns, verify in this order:

### 7.1 Git / Diff

```bash
git branch --show-current
git status --short
git log --oneline -5
```

Check:

- Did GLM commit anything?
- Are there uncommitted changes?
- Are all changes related to S1.5 blockers?
- Did it accidentally touch `.env`, legacy archive, or unrelated product areas?

### 7.2 Quality Gates

Re-run:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

### 7.3 File Size Gate

```bash
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0 \
  | xargs -0 wc -l \
  | awk '$2 != "total" && $1 > 300 {print}' \
  | sort -nr
```

Expected: empty.

Also inspect 250+ line files:

```bash
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) -print0 \
  | xargs -0 wc -l \
  | awk '$2 != "total" && $1 > 250 {print}' \
  | sort -nr
```

Current known 250+ files before GLM shift:

```text
apps/web/src/components/canvas/CanvasSpikeStylePanel.tsx ~293
apps/web/src/components/canvas/CanvasSpikeToolbar.tsx ~292
```

These are under the hard limit but should not grow further without splitting.

### 7.4 Manual UI Verification

Codex should verify or ask the user to verify:

- Five node creation still works.
- Inspector still appears and edits node data.
- Prompt / Image Gen / Image Gen 4 / Analysis / Image render correctly.
- Dynamic image input ports remain stable.
- Legal/illegal connections behave correctly.
- Disconnect button works only near node-node connections.
- Merge Capture preview still works.
- 60-node stress still works.
- External image paste limit still works.

### 7.5 Architecture / Scope Review

Reject or revert any GLM change that:

- Adds real AI provider calls before Model Registry / AI Runs slice.
- Adds dependencies without explicit approval.
- Moves state into `shape.props` that should be external Asset / AiRun / backend data.
- Reintroduces >300 line source files.
- Reintroduces old Text / Multi Generate / Image Editor as canonical P0 node wording.
- Touches legacy archive unnecessarily.

---

## 8. Next Recommended Work After Codex Returns

If GLM only hand-tests and records findings:

1. Codex reviews `debug-plans/s15-manual-test-2026-04-29.md`.
2. Codex fixes S1.5 blockers one by one.
3. Codex decides whether S1.5 passes or needs another spike iteration.

If GLM fixes blockers:

1. Codex reviews diff and reruns checks.
2. Codex hand-tests the affected interactions.
3. Codex decides whether to commit, amend, or revert.

If no blockers remain:

1. Mark S1.5 as pass / pass-with-known-risks in `project_state.md`.
2. Start Sprint S2: proper Node Picker and board route for five-node UI.
3. Do not start real AI calls until Model Registry slice is planned.

---

## 9. Current Do-Not-Forget List

- Right side is reserved for future AI Chat.
- Inspector/property panels stay on the left.
- Nodes are display/control surfaces, not databases.
- No Base64 / `data:` / `blob:` in persistent document state.
- Provider keys never enter frontend.
- Every source file stays under 300 lines.
- Stage checkpoints before large repairs.
- P0 node set is Prompt / Image Gen / Image Gen 4 / Analysis / Image.
- Current focus is S1.5 validation, not polish.
