# TANVAS Frontend Design Specification v2

> Based on `reference/stitch_tanvas_ai_canvas/` — 4 pages (Login, Dashboard, Canvas Editor, Settings)
> Source design system: "The Kinetic Blueprint" — Architectural Restraint, Ring Shadows, No-Lines

---

## 1. Fonts

| Role | Family | Weights | Usage |
|------|--------|---------|-------|
| **Headline** | `Space Grotesk` | 600, 700 | Page titles, section headers, nav brand, node titles |
| **Body** | `Inter` | 400, 500, 600 | Paragraphs, descriptions, form values |
| **Label** | `Inter` | 500, 600 | Buttons, nav items, form labels, tags — always `uppercase + tracking-widest` |
| **Icons** | `Material Symbols Outlined` | — | All iconography (replace custom SVGs) |

**Headline rules:**
- `letter-spacing: -0.02em` (tight tracking)
- `tracking-tighter` in Tailwind

**Label rules:**
- Always `text-xs uppercase tracking-widest font-semibold`
- Used for nav items, form labels, section dividers, status text

## 2. Color System

### Surface Layers (elevation hierarchy)

| Token | Hex | Usage |
|-------|-----|-------|
| `surface-container-low` | `#F5F3F3` | Page background, canvas bg, sidebar bg |
| `surface-container-lowest` | `#FFFFFF` | Cards, nodes, panels, modals |
| `surface` | `#FAF9F9` | Subtle hover state, input bg |
| `surface-container` | `#EFEDED` | Node section dividers, progress bar track |
| `surface-container-high` | `#E9E8E8` | Inactive nav bg, tags |
| `surface-container-highest` | `#E3E2E2` | Dividers, avatar fallback, progress bar bg |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#0E0F0F` | Body text, headings |
| `on-primary` | `#FFFFFF` | Text on dark surfaces |
| `primary-container` | `#242424` | Primary buttons, active nav, progress fill |
| `secondary` | `#5E5E5E` | Secondary text, descriptions |
| `outline` | `#747878` | Muted icons |
| `outline-variant` | `#C4C7C7` | Input ghost border, dividers |
| `on-surface-variant` | `#444748` | Labels, helper text |

### Functional (port/state colors)

| Color | Hex | Usage |
|-------|-----|-------|
| Purple | `#6349EA` | Prompt ports, accent gradient |
| Blue | `#3B82F6` | Text ports, processing state |
| Green | `#22C55E` | Image ports, success state |
| Red | `#EF4444` | Error state, delete actions |
| Tertiary accent | `#8A78FF` | Highlighted items |

### ❌ Strict rules
- **No borders** — use ring shadows or background shifts instead
- **No decorative color** — color only for ports/states
- **No gradients** except subtle `from-[color]/10 to-transparent` on thumbnails
- **No pure black `#000000`** — always `#242424` (carbon black)

## 3. Shadows (Ring Shadow System)

```css
/* Standard — cards, nodes, buttons */
ring-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05);

/* Focus — selected nodes, focused inputs */
ring-shadow-focus: 0 0 0 2px #242424, 0 4px 6px -1px rgba(0,0,0,0.1);

/* Glass topbar */
topbar: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05);
```

## 4. Border Radius

| Size | Value | Usage |
|------|-------|-------|
| DEFAULT | `2px (0.125rem)` | Small elements, inline badges |
| lg | `4px (0.25rem)` | Buttons, nav items |
| xl | `8px (0.5rem)` | Cards, nodes, panels, inputs |
| full | `12px (0.75rem)` | Avatars, floating bars |

## 5. Component Patterns

### Top Navigation Bar
- `bg-white/80 backdrop-blur-xl`
- `sticky top-0 z-50`
- Left: brand + nav tabs (active = `border-b-2 border-neutral-900 font-bold`)
- Right: icon buttons + avatar
- Height: ~56px

### Side Navigation Bar
- `bg-[#F5F5F5]` (surface-container-low), `w-64`
- Brand block: icon square + "TANVAS" headline + "Creative Engine" label
- Nav items: `text-xs uppercase tracking-widest font-semibold`
- Active item: `bg-white ring-shadow text-neutral-900`
- Inactive: `text-neutral-500 hover:bg-neutral-200/50`
- "New Workflow" button at bottom: `bg-primary-container text-on-primary`

### Login Page
- Centered card, `max-w-md`, `rounded-xl ring-shadow p-8 md:p-12`
- Brand: "TANVAS" in headline font, `text-3xl font-bold`
- Subtitle: `text-secondary text-sm font-medium`
- Inputs: ghost border style (`border: none; box-shadow: 0 1px 0 0 rgba(0,0,0,0.1)`)
- Focus: `box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)`
- Labels: `text-secondary text-xs font-semibold uppercase tracking-wider`
- Primary button: `bg-primary-container(#242424) text-white rounded-lg`
- Secondary button: `bg-white ring-shadow`
- Divider: `text-xs uppercase` with `bg-surface-container-highest` lines

### Workflow Cards (Dashboard)
- `rounded-xl ring-shadow h-56 p-5`
- Thumbnail: `bg-surface-container-low rounded-lg` with subtle color gradient overlay
- Hover: `bg-surface-bright`
- Title: `font-headline font-semibold`, hover = port color
- Timestamp: `text-xs text-on-surface-variant`
- "Create New" card: `bg-primary-container text-on-primary` with `hover:scale-[1.02] active:scale-[0.98]`

### Canvas Nodes
- `bg-white rounded-xl ring-shadow`
- Header: `p-3 border-b border-surface-container` with icon + title
- Body: `p-4` with inputs/content
- Footer: `p-2 border-t border-surface-container` with port dots (8px circles)
- Selected state: `ring-shadow-focus` (2px #242424 ring)
- Ports: 8px colored circles positioned absolutely on left edge

### Input Fields
- Ghost border: `border: none; box-shadow: inset 0 -1px 0 0 rgba(0,0,0,0.1)`
- Focus: `box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05)`
- No background fill, no rounded border

### Floating Footer Bar (Canvas)
- `bg-white/90 backdrop-blur-md rounded-full fixed bottom-4`
- Centered horizontally with `left-1/2 -translate-x-1/2`
- `px-6 py-2 ring-shadow`
- Status text: `text-xs uppercase tracking-wider font-label`

## 6. Layout Grid

- Dashboard cards: `grid-cols-3 gap-6`
- Canvas: dot grid background `radial-gradient(circle, #e3e2e2 1px, transparent 1px)` size 20px
- Sidebar: `w-64` fixed left
- Main content: `flex-1 md:ml-64 max-w-6xl`

## 7. Animation

- Hover transitions: `transition-colors duration-200`
- Button press: `active:scale-95` or `active:scale-[0.98]`
- "Create" card icon: `group-hover:rotate-90 transition-transform duration-300`
- Connection lines: `stroke: #C4C7C7; stroke-width: 2`

## 8. Icon System

Use **Material Symbols Outlined** for all icons. Key mappings:
- Dashboard: `dashboard`
- Recent: `schedule`
- Templates: `auto_awesome_motion`
- Trash: `delete`
- Add: `add`
- Settings: `settings`
- Notifications: `notifications`
- Search node: `search`
- Chat node: `chat`
- Optimize node: `tune`
- Image node: `image`
- Preview: `preview`
- Profile: `person`
- Billing: `credit_card`
- Team: `group`
- API: `key`
- Arrow: `arrow_forward`
- More: `more_vert`
