# TANGENT Stitch Canvas Reference Extraction

**Updated**: 2026-05-01  
**Source**: `reference/stitch_canvas_reference/**/code.html` and `reference/stitch_canvas_reference/quiet_editorial/DESIGN.md`

This file is the extraction layer for the new Stitch page references. `reference/Design.md` remains the canonical implementation spec; this document explains what each reference page contributes and how it maps to TANGENT routes.

---

## 1. Source Page Map

| Source folder | Page role | Current / future route | What to extract |
| --- | --- | --- | --- |
| `landing_page_vibrant` | Public landing page | Future `/` or public marketing route | Fixed editorial nav, 12-column hero, real visual hero card, coral signature stats band, mint bento section, dark CTA/footer rhythm |
| `pricing_vibrant` | Pricing page | Future `/pricing` | Pricing-only pill CTAs, three-tier cards, featured mint plan, horizontal comparison table |
| `google_sign_in_vibrant` | Auth choice | Future login entry variant | Split mint editorial panel, Google/email intent buttons, compact legal copy |
| `login_signup_vibrant_1` | Login variant, coral side panel | `/login` reference | Split-screen auth, coral signature side, bottom-border fields, remember + forgot row, divider, secondary signup action |
| `login_signup_vibrant_2` | Login variant, mint side panel | `/login` alternate | Same layout as above with calmer mint side panel |
| `register_vibrant` | Sign up | `/signup` | Split mint visual panel, email/password form, password visibility affordance, text link back to login |
| `forgot_password_vibrant` | Password reset | `/forgot-password` | Split mint panel, single email field, one primary action, back-to-login link |
| `create_account_details` | Onboarding details | Future `/account/setup` or post-signup step | Narrow 2/5 editorial side panel, full name/workspace/role fields, bottom-border select with chevron |
| `workspaces_vibrant` | Workspace board gallery/list | `/workspaces` | Fixed top nav + optional side nav, board gallery/list surface, dashed new-board card, pastel board cards, filter/sort/search controls |
| `management_team_billing` | Team/billing settings | `/team` / `/billing`, not current `/workspaces` | Persistent side nav, bento callouts, search/table rhythm, member table with role/status badges; current implementation stays placeholder-only |
| `quiet_editorial/DESIGN.md` | Token source | Global design tokens | Inter typography, #181d26 ink primary, white/soft gray surfaces, mint/coral/cream signature colors, 96px section rhythm |

---

## 2. Unified Visual Direction

The new reference direction is **Quiet Editorial**:

- White canvas is the default atmosphere.
- Near-black ink (`#181d26`) is both primary text and primary CTA.
- Inter is the active production font stack; do not introduce page-local Google font imports.
- Body copy stays compact at 14px; big type should be lighter, not bolder.
- Signature color is used as large surface area, not small decoration.
- Mint (`#c4eebd` / `#a8d1a2`) is the calm auth/workspace color.
- Coral (`#ff693c` / `#aa2d00`) is the energetic landing/login accent.
- Cream/peach/mustard can appear in cards and pricing, but avoid turning whole pages into one hue.
- Borders and tonal layers carry depth. Shadows stay minimal.
- Section rhythm is large: 96px vertical spacing on marketing surfaces, 32px gutters inside product dashboards.

Do not copy Stitch artifacts literally when they conflict with product rules:

- Do not add blur or bokeh blobs as decoration.
- Do not rely on remote generated-image URLs from the Stitch HTML in production code.
- Do not place auth pages inside the normal app navigation when the reference calls for a focused full-screen auth surface.
- Do not import Material Symbols just for icons; use the existing icon strategy in the app.
- Do not use dark-mode branches from generated HTML unless the product intentionally supports dark mode later.

---

## 3. Page Patterns

### Auth Split Screen

Use for `/login`, `/signup`, `/forgot-password`, `/verify-email`, and future account setup.

- Desktop: two columns, editorial color/image panel on the left and form canvas on the right.
- Mobile: hide the editorial panel; show compact TANGENT wordmark above the form.
- Side panel width can be 50% for login/signup/reset and 40% for account details.
- Preferred side panel is mint for calm account flows; coral is acceptable for a stronger login variant.
- Inputs use bottom border only, transparent background, uppercase 12px labels.
- Primary action is full-width near-black, 12px radius, at least 48px tall.
- Secondary action is text link or white outline button.
- Validation messages stay inline below helper copy.

### Public Marketing

Use for future landing and pricing pages.

- Top nav can be 80px and fixed/sticky, but content must remain readable without overlap.
- Hero uses real visual media or product UI fragments, not pure gradients.
- Landing hero is 12-column: copy 7 columns, visual 5 columns.
- Signature stats band uses coral as a full-width section.
- Product bento section uses mint/white/cream cards with uneven card spans.
- CTA band can use near-black or coral, with one primary action.

### Workspace Board Gallery/List

Use for `/workspaces`.

- Internal dashboard may use top nav plus left side nav once workspace/team routes become real.
- Current P0 App Shell uses the reference-style top nav plus left workspace sidebar across product pages.
- `/workspaces` is a gallery/list of Boards inside the active workspace, not Home/Collection/Settings/Account/Team/Subscription.
- Board cards should be large enough to scan: about 240-280px minimum height on desktop.
- New board is a dashed outline card with centered add action.
- Existing Boards use pastel signature surfaces, metadata row, and a clear open affordance.
- Board placeholder icons use a consistent ochre surface; card background color customization belongs in the future Panel / Board management flow, not directly on the gallery surface.
- Provide Gallery/List mode controls when there is enough space.
- Search/filter/sort belongs at the top of the board gallery.
- Card hover may reveal an arrow or action menu, but primary click target should remain obvious.
- Board card footer reserves space for collaborators, a Panel/settings entry, and a three-bar action menu with Rename, Copy board, and Delete.

### Home / Collection / Settings / Team / Subscription

Use for `/home`, `/collections`, `/settings`, `/account`, `/team`, and `/billing` pages.

- Layout is operational, not marketing-heavy.
- App Shell top navigation uses Home / Workspace / Collection / Team / Subscription. Account and Settings stay in the sidebar. Do not point Collection/Team/Subscription back to `/workspaces`.
- Bento callouts can summarize plan, storage, roles or workspace health.
- Member/team lists use a table with low-contrast header, 40px avatars, small role badges and status dots.
- Search is border-bottom or light hairline input.
- Invite/upgrade buttons remain near-black or white outline.

### Pricing

Use only for future pricing/commercial pages.

- Pricing buttons may use full pill radius.
- Cards are three-up on desktop and single-column on mobile.
- Featured plan can use mint and a small corner label.
- Comparison table uses horizontal scroll on tablet/mobile.
- Do not reuse pricing pill CTAs on auth, dashboard, canvas or settings pages.

---

## 4. Token Consolidation

Use these app tokens in implementation:

| Role | Hex | Notes |
| --- | --- | --- |
| Canvas | `#ffffff` | Default page and form surface |
| Surface soft | `#f8fafc` or `#f8f9fa` | Dashboard/page background and subtle panels |
| Surface container | `#edeeef` | Secondary dashboard card fill |
| Hairline | `#dddddd` / `#e1e3e4` | Borders and table dividers |
| Ink / primary | `#181d26` | Text and primary CTA |
| Primary active | `#0d1218` | Pressed primary CTA |
| Muted text | `#41454d` / `#45474b` | Body support and captions |
| Link/info | `#1b61c9` | Links only, not primary CTA |
| Coral | `#ff693c` / `#aa2d00` | Signature energy surfaces |
| Mint | `#c4eebd` / `#a8d1a2` | Auth/workspace calm surfaces |
| Cream | `#f5e9d4` | Callout/demo cards |
| Success | `#006400` | Confirmation states |
| Error | `#ba1a1a` | Form errors |

Typography:

- Display: 48-64px, weight 400-500, line-height about 1.1.
- Headline large: 40-48px, weight 400.
- Headline medium: 28-32px, weight 400-500.
- Body: 14px / 24px, weight 400.
- Label caps: 12px / 16px, weight 500, uppercase, `0.05em` letter spacing.
- Pricing display: 40px, weight about 475 when the stack supports it.

Radius:

- Inputs: 6px when boxed, or bottom-border only.
- Cards and buttons: 12px.
- Larger hero/signature cards: 12-16px.
- Pricing CTAs only: pill.

---

## 5. Implementation Order

Recommended page-by-page order:

1. ✅ Auth split-screen group: `/login`, `/signup`, `/forgot-password`, `/verify-email`.
2. Account setup details: future route or fold into `/account` when real onboarding starts.
3. ✅ `/workspaces`: upgraded from generic product cards to workspace Board gallery/list.
4. ✅ `/home`, `/collections`, `/settings`, `/account`, `/team`, `/billing`: add management structure without real collection CRUD, billing, team invites or session mutation.
5. `/boards`: keep current table/list behavior, then selectively borrow dashboard card rhythm.
6. Future `/pricing` and public landing route when P0 launch copy is ready.

Each page cut should update this mapping if the implemented route intentionally diverges from the source HTML.
