# Design System Reference — Cal.com Style

> 原始设计规范存档。TANVAS 基于 Cal.com 风格适配。

## Visual Theme & Atmosphere

Cal.com's website is a masterclass in monochromatic restraint — a grayscale world
where boldness comes not from color but from the sheer confidence of black text
on white space. Inspired by Uber's minimal aesthetic, the palette is deliberately
stripped of hue: near-black headings (#242424), mid-gray secondary text (#898989),
and pure white surfaces.

Cal Sans, the brand's custom geometric display typeface designed by Mark Davis,
is the visual centerpiece. Letters are intentionally spaced extremely close at
large sizes, creating dense, architectural headlines. At 64px and 48px, Cal Sans
headings sit at weight 600 with a tight 1.10 line-height — confident, compressed,
and immediately recognizable. For body text, the system switches to Inter,
providing "rock-solid" readability.

The elevation system uses 11 shadow definitions creating a nuanced depth hierarchy
using multi-layered shadows that combine ring borders (0px 0px 0px 1px), soft
diffused shadows, and inset highlights. This shadow-first approach (rather than
border-first) gives surfaces subtle three-dimensionality.

**Key Characteristics:**
- Purely grayscale brand palette — no brand colors, boldness through monochrome
- Cal Sans custom geometric display font with extremely tight default letter-spacing
- Multi-layered shadow system (11 definitions) with ring borders + diffused shadows
- Cal Sans for headings, Inter for body — clean typographic division
- White canvas with near-black (#242424) text — maximum contrast, zero decoration
- Product screenshots as primary visual content

## Color Palette

### Primary
- Charcoal (#242424): Primary heading and button text
- Midnight (#111111): Deepest text/overlay
- White (#ffffff): Primary background and surface

### Secondary
- Link Blue (#0099ff): Hyperlinks only
- Mid Gray (#898989): Secondary text, descriptions
- Border: rgba(34, 42, 53, 0.08–0.10) — shadow-based ring borders

### Philosophy
- Grayscale brand — color reserved for links and UI states only
- No gradients — fully flat and monochrome
- Depth through shadows, not color transitions

## Typography

### Fonts
- Display: Cal Sans — custom geometric sans-serif, weight 600, tight spacing
- Body: Inter — reliable, weights 300–600
- UI Light: Cal Sans UI Variable Light — weight 300, -0.2px tracking
- Mono: Roboto Mono

### Hierarchy
| Role | Font | Size | Weight | Line Height | Letter Spacing |
|------|------|------|--------|-------------|----------------|
| Display Hero | Cal Sans | 64px | 600 | 1.10 | 0px |
| Section Heading | Cal Sans | 48px | 600 | 1.10 | 0px |
| Feature Heading | Cal Sans | 24px | 600 | 1.30 | 0px |
| Sub-heading | Cal Sans | 20px | 600 | 1.20 | +0.2px |
| Card Title | Cal Sans | 16px | 600 | 1.10 | 0px |
| Body Light | Cal Sans UI Light | 18px | 300 | 1.30 | -0.2px |
| UI Label | Inter | 16px | 600 | 1.00 | 0px |
| Caption | Inter | 14px | 500 | 1.14 | 0px |
| Micro | Inter | 12px | 500 | 1.00 | 0px |

### Principles
- Cal Sans exclusively for headings (24px+), never body text
- Positive letter-spacing (+0.2px) below 24px to prevent cramming
- Weight 600 dominance for Cal Sans
- Negative tracking (-0.2px) on Cal Sans UI Light body text

## Shadow System (11 Definitions)

| Level | Shadow | Use |
|-------|--------|-----|
| L0 | None | Page canvas |
| L1 Inset | rgba(0,0,0,0.16) 0px 1px 1.9px 0px inset | Pressed/recessed |
| L2 Ring+Soft | rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px | Cards (workhorse) |
| L3 Ring+Soft Alt | rgba(36,36,36,0.7) 0px 1px 5px -4px, rgba(36,36,36,0.05) 0px 4px 8px | Alt card elevation |
| L4 Inset Highlight | rgba(255,255,255,0.15) 0px 2px 0px inset | Button 3D bevel |
| L5 Soft Only | rgba(34,42,53,0.05) 0px 4px 8px | Subtle ambient |

### Shadow Philosophy
- Ring borders (0px 0px 0px 1px) act as borders — no CSS border
- Diffused soft shadows (5% opacity) — gentle ambient depth
- Sharp contact shadows (70% opacity, -4px spread) — grounding
- Shadows composed in comma-separated stacks — 2-3 layers per surface

## Border Radius Scale
2px → 4px → 6-7px → 8px → 12px → 16px → 29px → 100px → 1000px → 9999px (pill)

## Component Styling

### Buttons
- Dark Primary: #242424 bg, white text, 6-8px radius, hover opacity 0.7
- White/Ghost: white bg, shadow-ring border, dark text
- Pill: 9999px radius

### Cards
- White bg, multi-layered shadow (ring + diffused), 8-12px radius
- No CSS borders — shadow-first

## Spacing
- Base: 8px
- Scale: 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 28, 80, 96px
- Section spacing: 80-96px vertical

## Do's and Don'ts

### Do
- Cal Sans only for headings (24px+)
- Grayscale palette — boldness through contrast
- Multi-layered shadow for elevation
- Generous section spacing (80px+)
- Product content as visual

### Don't
- Cal Sans for body text or below 16px
- Add brand colors (grayscale only)
- Use CSS borders when shadows work
- Heavy dark shadows (>5% opacity diffused)
- Decorative illustrations or abstract graphics
