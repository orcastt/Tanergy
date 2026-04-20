# Design System Strategy: The Kinetic Blueprint

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Kinetic Blueprint."** 

This system is not a set of static containers; it is a high-precision instrument for AI orchestration. We are moving away from the "web-as-a-document" legacy and toward a "canvas-as-an-engine" philosophy. By stripping away visual noise—eliminating 1px borders and loud decorative colors—we create a workspace of radical focus. 

The aesthetic is characterized by **Architectural Restraint**: using mathematical spacing and tonal layering to communicate hierarchy. Like a premium physical architect's blueprint, every mark on the screen must be intentional. The UI should feel like a "quiet stage" where the user's AI-generated content is the only permitted spectacle.

---

## 2. Colors & Tonal Logic

### The Grayscale Foundation
The palette is rooted in a pure grayscale spectrum to ensure the interface remains invisible until interacted with.

*   **Primary (Carbon Black):** `#242424` – Used for high-emphasis text and primary action surfaces.
*   **Surface (Pure White):** `#FFFFFF` – The base for cards, menus, and elevated panels.
*   **Canvas (Light Gray):** `#F5F5F5` (mapped to `surface_container_low`) – The infinite workspace background.
*   **Muted Text:** `#898989` – For secondary information and helper text.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined through:
1.  **Background Shifts:** Distinguish sections by placing `surface_container_lowest` (#FFFFFF) against `surface_container_low` (#F5F5F5).
2.  **Ring Shadows:** Use the "Ghost Border" technique (see Section 4) to define interactive elements.

### Functional Color (The "Signal" Rule)
Color is reserved strictly for functionality and state. It should never be used for decoration.
*   **Node Ports:** 
    *   `#6349EA` (Purple) - Prompt Inputs/Outputs
    *   `#22C55E` (Green) - Image Data
    *   `#3B82F6` (Blue) - Text/Logic Data
*   **States:** 
    *   `#3B82F6` - Processing/Running
    *   `#22C55E` - Success
    *   `#EF4444` - Error

---

## 3. Typography: Editorial Precision
The system utilizes a dual-font strategy to balance geometric character with functional legibility.

*   **Headings (Cal Sans):** Weight 600. Used for `display`, `headline`, and `title-lg`. Cal Sans provides a tight, geometric, and "engineered" feel. Set with tight letter-spacing (-0.02em) to create an authoritative, editorial look.
*   **Body & Utility (Inter):** Used for `body` and `label` tiers. Inter is chosen for its neutral, objective quality. It ensures that complex AI data remains readable at small sizes.

**Hierarchy Goal:** Large, bold headings create clear entry points, while smaller, high-contrast labels provide the technical detail required for a workflow platform.

---

## 4. Elevation & Depth: The Ring Shadow
We achieve depth through **Tonal Layering** and **Multi-Layered Shadows** rather than traditional structural lines.

### The Ring Shadow Technique
To create a clean, architectural look, replace CSS borders with a multi-layered shadow stack. This creates a "hairline" feel that is softer and more premium than a standard border.
*   **Standard Component Ring:** `box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px 0 rgba(0,0,0,0.05);`
*   **Focused Element:** `box-shadow: 0 0 0 2px #242424, 0 4px 6px -1px rgba(0,0,0,0.1);`

### Glassmorphism & Depth
For floating panels (e.g., node inspectors, toolbars), use semi-transparent white with a high backdrop-blur to maintain context of the underlying canvas:
*   **Surface:** `rgba(255, 255, 255, 0.8)`
*   **Backdrop Blur:** `12px`

### The Layering Principle
*   **Layer 0 (Canvas):** `#F5F5F5`
*   **Layer 1 (Cards/Nodes):** `#FFFFFF` with a 1px Ring Shadow.
*   **Layer 2 (Modals/Popovers):** `#FFFFFF` with an Ambient Shadow (12% opacity, 20px blur).

---

## 5. Component Logic

### Buttons
*   **Primary:** Carbon Black (`#242424`) background, White text. No border. Sharp `0.25rem` (4px) radius.
*   **Secondary:** White background, Carbon Black text. 1px Ring Shadow.
*   **Tertiary:** Ghost style. No background/border until hover.

### Workflow Nodes
Nodes are the heart of the system.
*   **Container:** Pure White surface, `0.5rem` radius.
*   **Header:** Cal Sans, `title-sm`. 
*   **Ports:** 8px circles using the Functional Color palette.
*   **Interaction:** On select, the node receives a 2px Carbon Black ring shadow.

### Input Fields
*   **Styling:** Remove all background fills. Use a bottom-only "Ghost Border" (10% opacity black) that transforms into a 1px Ring Shadow on focus.
*   **Micro-copy:** All helper text must use `label-sm` in Medium Gray (`#898989`).

### Cards & Lists
*   **No Dividers:** Prohibit the use of horizontal rules. Separate list items using 12px or 16px of vertical white space.
*   **Hover State:** Shift background color from `#FFFFFF` to `#F9F9F9` to indicate interactivity.

---

## 6. Do’s and Don'ts

### Do
*   **Do** use white space as a structural element. If an interface feels cluttered, increase the padding rather than adding a line.
*   **Do** ensure Cal Sans is used only for short-form text (headings). It is too geometric for long-form body copy.
*   **Do** use "Optical Alignment." Because Cal Sans is geometric, sometimes headers need a 1px-2px nudge to look visually centered.

### Don’t
*   **Don’t** use pure black (`#000000`). Always use Carbon Black (`#242424`) to keep the interface feeling premium and "ink-like" rather than digital-harsh.
*   **Don’t** use shadows to indicate "glow." Shadows should only represent physical elevation from the canvas.
*   **Don’t** use functional colors for anything other than their assigned data types. A purple button is a violation of the system unless that button specifically triggers a Prompt action.
*   **Don’t** use 100% opaque, high-contrast borders. If a container needs a boundary, use a ring shadow or a subtle background tint.