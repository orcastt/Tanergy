# App Routes

Current production-facing routes:

- `/`: public Tanergy landing page.
- `/sign-in`, `/sign-up`: Clerk Auth entry points with Google-ready social login.
- `/login`, `/signup`, `/register`, `/forgot-password`, `/verify-email`: compatibility redirects.
- `/workspaces`: protected workspace and Board gallery shell.
- `/boards`: compatibility redirect to `/workspaces`.
- `/boards/[boardId]`: formal Konva Board shell.
- `/share/[shareId]`: public view-only shared Konva Board entry.
- `/billing`: signed-in user's own plan, credits, payer summary and usage view.
- `/team`: Group/Team workspace structure and Team usage visibility view.
- `/admin`: server-gated first-pass admin surface.

Development-only routes:

- `/spikes/konva-canvas`: Konva regression and prototype surface.

Route ownership stays in PRD/ARCH/project_state slice docs. Keep this file as a short map only.
