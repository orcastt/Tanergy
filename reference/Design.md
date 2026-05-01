# Airtable-Inspired Product Shell Design

## Overview

Airtable's marketing surfaces are quietly editorial. The base atmosphere is white canvas, dark ink type, generous whitespace, and a near-black pill CTA -- nothing is fighting for attention until a section needs to. The brand voltage doesn't come from gradient washes or accent walls; it comes from **full-bleed signature cards** in `{colors.signature-coral}`, `{colors.signature-forest}`, and `{colors.surface-dark}` that punctuate long-scroll explainer pages every two or three screens. Between those signature bands, the page reads like a print magazine: a headline, supporting copy, a small image cluster, then breathing room.

Type voice is Haas Grotesk at modest weights (400 for display, 500 for sub-titles and buttons). Display headlines never go bolder than 500 -- emphasis comes from size and color contrast, not from weight. Body copy stays at 14px / 400 throughout. The pricing surface runs its own dialect: **Inter Display** at unusual mid-weights (475 / 575) and **pill-shaped buttons** (`{rounded.pill}`) that don't appear on any other page -- a deliberate sub-system signaling "this page is about commercial precision."

**Key Characteristics:**

- Primary CTA is `{colors.primary}` (near-black ink) with white text and a `{rounded.lg}` (12px) corner -- it reads as confident and final, never decorative.
- Secondary CTA is a `{colors.canvas}` button with `{colors.ink}` text and a hairline outline. The two together form Airtable's signature button pair.
- Hero is white canvas. There is no atmospheric gradient, no mesh, no background flourish. The brand strength comes from the type and the buttons sitting in clean whitespace.
- Brand voltage lives in **signature surface cards**: `{colors.signature-coral}`, `{colors.signature-forest}`, and `{colors.surface-dark}` carry full-bleed product callouts every few screens.
- Demo-card grids carry product UI fragments on `{colors.signature-peach}`, `{colors.signature-mint}`, `{colors.signature-cream}` and other warm pastel surfaces.
- Section rhythm: white canvas -> coral signature card -> white body -> cream callout band -> dark navy CTA -> light gray CTA banner -> footer. The canvas resets between every signature surface.
- Border radius is hierarchical: `{rounded.lg}` (12px) for primary CTAs and large signature cards, `{rounded.md}` (10px) for content cards and demo grids, `{rounded.sm}` (6px) for inputs, `{rounded.full}` for icon buttons. Pricing buttons jump to `{rounded.pill}` to mark themselves as a separate dialect.
- Vertical rhythm is `{spacing.section}` (96px) between major bands -- universal across every page.

## Colors

### Brand & Accent

- **Primary** (`{colors.primary}` -- #181d26): The dominant brand color. Used for the primary CTA background, h1/h2 display type, and the `{component.surface-dark}` band. Not "blue, then black" -- black IS the primary throughout the marketing system.
- **Primary Active** (`{colors.primary-active}` -- #0d1218): The press state on primary buttons.

### Surface

- **Canvas** (`{colors.canvas}` -- #ffffff): The default page surface; the floor of every editorial body.
- **Surface Soft** (`{colors.surface-soft}` -- #f8fafc): Tabbed feature cards and the featured pricing tier.
- **Surface Strong** (`{colors.surface-strong}` -- #e0e2e6): The light gray "Start building with Airtable" CTA banner near the footer.
- **Surface Dark** (`{colors.surface-dark}` -- #181d26): The dark navy CTA cards used mid-page.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` -- #1d1f25): The articles-page hero base behind the rainbow-stripe overlay.
- **Hairline** (`{colors.hairline}` -- #dddddd): The 1px border tone for input outlines, table dividers, secondary-button outlines.

### Text

- **Ink** (`{colors.ink}` -- #181d26): The strongest text -- h1/h2 display type and primary button text-on-light. Same hex as `{colors.primary}` because they are the same role expressed at type and button layers.
- **Body** (`{colors.body}` -- #333840): The default running-text color.
- **Muted** (`{colors.muted}` -- #41454d): Footer links, breadcrumbs, captions.
- **Border Strong** (`{colors.border-strong}` -- #9297a0): The 1px outline color on disabled secondary buttons.
- **On Primary / On Dark** (`{colors.on-primary}` -- #ffffff): The text color on primary buttons and dark surfaces.

### Signature Card Surfaces

These are the colors that carry Airtable's brand voltage. They appear as full-bleed, full-card surfaces -- never as accents on a small element.

- **Coral** (`{colors.signature-coral}` -- #aa2d00): Full-bleed dark coral with white type.
- **Forest** (`{colors.signature-forest}` -- #0a2e0e): A deep-green signature card used in demo-grid clusters.
- **Cream** (`{colors.signature-cream}` -- #f5e9d4): A soft beige surface holding dark type and product UI fragments.
- **Peach** (`{colors.signature-peach}` -- #fcab79), **Mint** (`{colors.signature-mint}` -- #a8d8c4), **Yellow** (`{colors.signature-yellow}` -- #f4d35e), **Mustard** (`{colors.signature-mustard}` -- #d9a441): Demo-card surfaces that carry small product UI fragments inside multi-card grid sections.

### Semantic

- **Link** (`{colors.link}` -- #1b61c9): Inline body links and anchor text. Darker on press to `{colors.link-active}` (#1a3866). This color is not the primary button color.
- **Info** (`{colors.info}` -- #254fad) and **Info Border** (`{colors.info-border}` -- #458fff): Inline info badges and focused-input outline.
- **Success** (`{colors.success}` -- #006400) and **Success Border** (`{colors.success-border}` -- #39bf45): Confirmation states.

## Typography

### Font Family

The system runs **Haas / Haas Groot Disp** where available. The fallback stack walks `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`.

The pricing surface runs a separate **Inter Display** stack at mid-weights (475 / 575) -- a deliberate sub-system signaling commercial precision.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 48px | 500 | 1.1 | 0 | Articles page h2 -- second-tier editorial headline |
| `{typography.display-lg}` | 40px | 400 | 1.2 | 0 | Homepage h1 hero |
| `{typography.display-md}` | 32px | 400 | 1.2 | 0 | Platform-page h2 -- feature-section headlines |
| `{typography.title-lg}` | 24px | 400 | 1.35 | 0.12px | Section titles |
| `{typography.title-md}` | 20px | 400 | 1.5 | 0 | Sub-section titles in tabbed feature cards |
| `{typography.title-sm}` | 18px | 500 | 1.4 | 0 | Article-card titles |
| `{typography.label-md}` | 16px | 500 | 1.4 | 0 | Demo-card titles, list labels |
| `{typography.button}` | 16px | 500 | 1.4 | 0 | Standard CTA button labels |
| `{typography.body-md}` | 14px | 400 | 1.25 | 0 | Body copy, footer links, top-nav items |
| `{typography.caption}` | 14px | 500 | 1.35 | 0.16px | Light captions and meta text |
| `{typography.legal}` | 13.12px | 600 | 1.2 | 0 | Cookie/legal CTA buttons |
| `{typography.pricing-display}` | 44.8px | 475 | 1.1 | 0 | Pricing-page h1 |
| `{typography.pricing-section}` | 28px | 475 | 1.2 | 0 | Pricing-page section heads |
| `{typography.pricing-card-title}` | 20px | 475 | 1.3 | 0 | Pricing tier card plan name |

### Principles

The Haas system prefers weight 400 for display sizes -- a 40px h1 is not bold. Visual emphasis is delegated to size, color contrast, and the signature surface cards. Where the system does want weight, it pivots to 500 (sub-titles, buttons, article titles), never 600 or 700 in the editorial body. The only true bold (600) lives in `{typography.legal}`.

### Note on Font Substitutes

If Haas Groot Disp and Haas Grotesk are unavailable, **Inter Display** (variable) is the closest open-source substitute. On macOS / iOS, **system-ui** is sufficient; on Windows, the chain falls through to Segoe UI.

## Layout

### Spacing System

- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px, `{spacing.xs}` 8px, `{spacing.sm}` 12px, `{spacing.md}` 16px, `{spacing.lg}` 24px, `{spacing.xl}` 32px, `{spacing.xxl}` 48px, `{spacing.section}` 96px.
- **Section padding:** `{spacing.section}` (96px) top and bottom.
- **Card internal padding:** `{spacing.xl}` (32px) for tabbed feature cards and pricing tier cards; `{spacing.xxl}` (48px) inside signature coral / forest / dark cards; `{spacing.lg}` (24px) for cream callouts and demo-grid cards.
- **Gutters:** `{spacing.lg}` (24px) between cards in 3-up grids; `{spacing.md}` (16px) inside denser logo strips and footer column gutters.

### Grid & Container

- **Max content width:** ~1280px centered, with `{spacing.xxl}` (48px) horizontal breathing room.
- **Editorial body:** Single 8/12-column at large breakpoints, collapsing to single-column on mobile.
- **Demo-card grids:** 3 or 4 columns at desktop, 2 at tablet, 1 at mobile. Card sizes are deliberately uneven within the grid.
- **Logo strip:** 6 monochrome partner logos in a single row at desktop; wraps to 3-up on mobile.

### Whitespace Philosophy

Whitespace is the dominant atmospheric tool. Hero sections sit in 96px+ of pure whitespace above and below the headline + sub-headline pair, with no decoration in that whitespace.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Body sections, top nav, footer |
| Soft hairline | 1px `{colors.hairline}` border | Inputs, sub-nav rails, comparison-table dividers, secondary buttons |
| Button rest | Soft drop with subtle blue-tinted glow at low alpha | Primary CTA buttons |
| Button focus | Outer 2px blue ring at higher alpha | Keyboard focus state on primary buttons |
| Card flat | No shadow; relies on color contrast against the surface band | Signature coral / forest / dark cards, cream callouts, demo-grid cards |

The elevation philosophy is **color-block first, shadow second**. Shadows are minimal; depth is delegated to the contrast between white canvas and signature surface cards.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 2px | Cookie-consent and legal CTA buttons |
| `{rounded.sm}` | 6px | Text inputs, small inline buttons |
| `{rounded.md}` | 10px | Secondary content cards, article cards, cream callouts |
| `{rounded.lg}` | 12px | Primary CTA buttons, signature surface cards, tabbed feature cards |
| `{rounded.pill}` | 9999px | Pricing-page CTA buttons only |
| `{rounded.full}` | 9999px / 50% | Circular icon buttons, avatar surfaces |

## Components

**`top-nav`** -- A 64px-tall white bar pinned to the top of every page. Wordmark sits at left; primary horizontal menu sits center-left in `{typography.body-md}`; the right cluster carries a secondary outline link, primary CTA, and login text link. The nav stays light on every page.

### Buttons

**`button-primary`** -- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}`, padding 16px x 24px, rounded `{rounded.lg}`. Active state darkens to `{colors.primary-active}`.

**`button-secondary`** -- White outline button. Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.button}`, rounded `{rounded.lg}`, 1px hairline outline.

**`button-secondary-on-dark`** -- Same shape as `{component.button-secondary}` but used on signature coral / forest / dark surfaces.

**`button-pricing-pill`** -- Pricing-page CTA family. Background `{colors.canvas}`, text `{colors.pricing-ink}`, rounded `{rounded.pill}`, padding 12px x 24px. Do not use outside pricing.

**`button-legal`** -- Cookie-consent and legal-banner CTAs. Background `{colors.link}`, text `{colors.on-primary}`, type `{typography.legal}`, rounded `{rounded.xs}`, padding 12px x 10px.

**`button-icon-circular`** -- 40px x 40px circular button with `{colors.canvas}` background, hairline border, and `{colors.ink}` icon.

**`text-link`** -- Inline body links in `{colors.link}`. No underline by default.

### Cards & Containers

**`hero-band`** -- The full-page-width white-canvas hero. No surface card, no border, no shadow, no atmospheric gradient; just headline, sub-headline, and primary + secondary button pair in whitespace. Vertical padding `{spacing.section}`.

**`signature-coral-card`** -- Large full-bleed coral card. Background `{colors.signature-coral}`, text `{colors.on-primary}`, rounded `{rounded.lg}`, internal padding `{spacing.xxl}`.

**`signature-forest-card`** -- Deep green signature card (`{colors.signature-forest}`).

**`hero-card-dark`** -- Dark navy mid-page CTA card. Background `{colors.surface-dark}`, text `{colors.on-dark}`, rounded `{rounded.lg}`, internal padding `{spacing.xxl}`.

**`feature-card-tabbed`** -- Light-cream cards. Background `{colors.surface-soft}`, rounded `{rounded.lg}`, internal padding `{spacing.xl}`.

**`cream-callout-card`** -- Beige callout cards (`{colors.signature-cream}`). Rounded `{rounded.md}`, internal padding `{spacing.lg}`.

**`demo-grid-card`** -- Used in multi-card grids. Background `{colors.canvas}` or one of the demo-grid surfaces, rounded `{rounded.md}`, internal padding `{spacing.md}`. Card heights vary deliberately.

**`logo-strip`** -- Horizontal monochrome partner-logo row. Logos render in `{colors.muted}`, surface is `{colors.canvas}`, vertical padding `{spacing.xl}`.

**`article-card`** -- Background `{colors.canvas}`, rounded `{rounded.md}`, internal padding `{spacing.md}`.

**`topic-filter-rail`** -- Left rail for grouped navigation or filters.

### Inputs & Forms

**`text-input`** -- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-md}`, rounded `{rounded.sm}`, padding 12px x 16px, height 44px. 1px hairline border in `{colors.hairline}`.

**`text-input-focus`** -- Focus state. Border thickens or recolors to `{colors.info-border}`.

### Pricing Sub-System

**`pricing-tier-card`** -- Standard tier card. Background `{colors.canvas}`, type `{typography.pricing-card-title}` for the plan name, rounded `{rounded.md}`, internal padding `{spacing.xl}`.

**`pricing-tier-card-featured`** -- Featured tier background shifts to `{colors.surface-soft}`.

**`pricing-comparison-row`** -- 12px vertical padding with hairline divider between rows.

### Navigation Variants

**`footer`** -- Light surface (`{colors.canvas}`), 6-column link list at desktop. Vertical padding `{spacing.section}` divided across upper link block and lower legal row. Type `{typography.body-md}`.

**`cta-band-light`** -- Light gray CTA strip near the footer. Background `{colors.surface-strong}`, text `{colors.ink}`, rounded `{rounded.lg}`, padding `{spacing.xxl}`.

## Do's and Don'ts

### Do

- Keep `{component.button-primary}` near-black. The brand's primary CTA is `{colors.primary}`, not the link blue.
- Reserve `{component.button-primary}` for one primary action per viewport.
- Use `{component.button-secondary}` as the natural pair with `{component.button-primary}`.
- Trust whitespace as the hero atmosphere.
- Use `{component.signature-coral-card}`, `{component.signature-forest-card}`, and `{component.hero-card-dark}` to break editorial monotony.
- Keep `{component.demo-grid-card}` heights uneven within a grid.
- Treat the pricing surface as its own dialect.
- Anchor every editorial band with `{spacing.section}` (96px) vertical padding.

### Don't

- Don't make `{colors.link}` the primary button color.
- Don't add a gradient backdrop to the hero.
- Don't bold display-weight type.
- Don't use `{rounded.pill}` outside the pricing surface.
- Don't repeat the same surface mode in two consecutive bands.
- Don't add hover state styling beyond what the system already encodes.
- Don't introduce additional accent colors beyond the documented signature card palette.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Single-column body; top nav collapses to hamburger; demo-grid drops to 1-up; signature cards stay full-bleed; footer collapses to single-column |
| Tablet | 768-1024px | 2-up demo-grid; top nav tightens; cream-callout cards stack 2-up; pricing comparison table becomes horizontally scrollable |
| Desktop | 1024-1440px | 3-up demo-grid; full top-nav visible; pricing tier cards render 4-across |
| Wide | > 1440px | Same as Desktop with more outer breathing room; max content width caps at ~1280px |

### Touch Targets

- `{component.button-primary}` and siblings render at 48 x 48px minimum.
- `{component.button-icon-circular}` is exactly 40 x 40px.
- `{component.text-input}` height is 44px.

### Collapsing Strategy

- Top nav collapses to a hamburger at < 768px; the menu opens as a full-screen sheet rather than a dropdown.
- Card grids reduce columns rather than scaling cards down.
- `{component.feature-card-tabbed}` re-stacks the tab rail above the content pane on mobile.
- Pricing comparison table converts to horizontally-scrollable swipe at < 1024px.

### Image Behavior

- Demo-card UI screenshots crop to fit their container rather than scaling up.
- Hero illustrations bleed full-width on mobile, losing horizontal margin.
- Signature card images compress to their card width without cropping.

## Iteration Guide

1. Focus on one component at a time. Reference its YAML key directly.
2. When adding a new component, decide first which sub-system it belongs to: the main editorial system or the pricing sub-system.
3. Variants of an existing component (`-active`, `-disabled`, `-focus`) live as separate entries in `components:` -- never as nested state objects.
4. Use `{token.refs}` everywhere prose mentions a color, a radius, a typography role, or a spacing value.
5. Never document hover. The system documents Default and Active/Pressed states only.
6. Run `npx @google/design.md lint DESIGN.md` after edits when that tool is available.
7. When in doubt about emphasis: bigger type before bolder type, signature surface card before solid accent.

## Known Gaps

- The exact hex values of pastel demo-grid surfaces are inferred from screenshot pixel sampling.
- Hover behavior across all components is not documented.
- Animation and transition timings are not in scope.
- Form validation states beyond `text-input-focus` are not extracted.
- The pricing comparison table's checkmark glyph and column-divider widths are described structurally but not formalized as tokens.
- The CSS variable `--theme_button-background-primary: #1b61c9` exists at `:root` but is not used as the primary CTA color anywhere on the marketing site. It maps to the link/info color role instead.
