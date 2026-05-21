---
name: Quiet Editorial
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#45474b'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#76777c'
  outline-variant: '#c6c6cc'
  surface-tint: '#5a5e69'
  primary: '#000208'
  on-primary: '#ffffff'
  primary-container: '#181d26'
  on-primary-container: '#808590'
  inverse-primary: '#c2c6d3'
  secondary: '#af3003'
  on-secondary: '#ffffff'
  secondary-container: '#ff693c'
  on-secondary-container: '#601500'
  tertiary: '#000300'
  on-tertiary: '#ffffff'
  tertiary-container: '#002305'
  on-tertiary-container: '#688e65'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dee2ef'
  primary-fixed-dim: '#c2c6d3'
  on-primary-fixed: '#171c25'
  on-primary-fixed-variant: '#424751'
  secondary-fixed: '#ffdbd1'
  secondary-fixed-dim: '#ffb5a0'
  on-secondary-fixed: '#3b0900'
  on-secondary-fixed-variant: '#862200'
  tertiary-fixed: '#c4eebd'
  tertiary-fixed-dim: '#a8d1a2'
  on-tertiary-fixed: '#002205'
  on-tertiary-fixed-variant: '#2b4f2b'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 64px
    fontWeight: '400'
    lineHeight: 72px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
  pricing-display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '475'
    lineHeight: 48px
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  section-v-padding: 96px
  container-max-width: 1200px
  gutter: 32px
  stack-sm: 12px
  stack-md: 24px
---

## Brand & Style

The design system is rooted in a "quietly editorial" aesthetic, prioritizing clarity, intentionality, and high-end structural organization. It bridges the gap between high-utility SaaS and the sophisticated layout of modern architectural or lifestyle publications.

The design style is **Minimalism** with a heavy emphasis on typographic rhythm. It avoids excessive decoration, relying instead on a strict "white canvas" philosophy where negative space is treated as a functional element rather than a void. The atmosphere is professional yet approachable, conveying a sense of organized creative potential.

## Colors

The palette is built on a foundation of high-contrast neutrals. The primary "Ink" (#181D26) serves as both the dominant typographic color and the primary action color. 

Signature color blocks are used sparingly but with high impact. These are reserved for full-bleed sections or major card components:
- **Coral (#AA2D00):** Used for moments of high energy or vital focus.
- **Forest (#0A2E0E):** Used to convey stability and organic growth.
- **Dark Navy (#181D26):** Used for grounding the layout in authoritative sections.

The background remains a pure white canvas to ensure the editorial "ink-on-paper" feeling persists throughout the experience.

## Typography

This design system utilizes **Inter** as its workhorse typeface, leaning into its utilitarian yet refined character. The typographic hierarchy is strictly controlled to maintain the editorial tone.

- **Headlines:** Display type never exceeds a 500 weight. The preference is 400 for large display areas to maintain an airy, lightweight feel.
- **Body:** Standardized at 14px for a compact, modern look that mirrors information-dense marketing layouts. 
- **Sub-system (Pricing):** For pricing tiers and specific conversion modules, use a "mid-weight" of 475 to provide just enough visual prominence without the aggression of a standard Bold weight.

## Layout & Spacing

The layout follows a **fixed grid** model, centered within the viewport. To achieve the signature editorial rhythm, verticality is emphasized through generous 96px padding between major sections.

Content is organized using a 12-column grid. Elements should feel "hung" on the grid with intentional misalignment in some areas to create a dynamic, magazine-like flow. Margins are wide, ensuring that the "white canvas" frames the content effectively.

## Elevation & Depth

This design system avoids traditional drop shadows. Depth is communicated through **low-contrast outlines** and **tonal layering**.

- **Cards & Containers:** Use a 1px hairline border in a light grey (approximately #E5E7EB) or the ink color at very low opacity.
- **Color Blocks:** Full-bleed color blocks provide the most significant sense of depth, effectively "sinking" the content or "elevating" it through sheer color contrast against the white canvas.
- **Interactive States:** Subtle shifts in background tone (e.g., White to #F9FAFB) indicate hover states rather than lifting elements off the page.

## Shapes

The shape language is sophisticated and intentional. 

- **Primary Radius:** A 12px radius is the standard for primary CTA buttons and major cards. This provides a modern, softened geometric feel that isn't overly "bubbly."
- **Pill Shapes:** Reserved exclusively for the pricing sub-system and specific chips/labels. This distinction helps users identify high-utility or transactional areas of the product.
- **Color Blocks:** Signature full-bleed blocks typically have 0px radius where they meet the edge of the viewport, but interior cards within them retain the 12px standard.

## Components

### Buttons
- **Primary:** Filled #181D26 with White text. 12px corners. Used for the main site-wide CTAs.
- **Secondary:** White background with a 1px hairline outline in #181D26. 12px corners.
- **Pricing CTA:** Pill-shaped (999px radius) using the primary ink color.

### Cards
- **Editorial Cards:** Large containers with 12px radius. Can be white with hairline borders or use the signature color blocks (Coral, Forest, Navy). 
- **Internal Padding:** Use 32px or 48px padding within cards to maintain the atmosphere of generous whitespace.

### Inputs & Forms
- **Fields:** Minimalist bottom-border only or very light 4-sided hairline borders. Focus states use a subtle 1px solid ink stroke.
- **Labels:** 12px Uppercase with 0.05em tracking for a structured, metadata-heavy appearance.

### Pricing Tiers
- Distinct from the rest of the site, these utilize the 475 weight typography and pill-shaped buttons to create a "sub-system" feel that signals a shift from brand storytelling to product selection.