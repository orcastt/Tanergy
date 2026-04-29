# Legacy Archive Rules

This directory contains frozen historical code from the old Tauri desktop, Admin, backend, WeChat/Html Editor, Writer, and Personal Library direction.

Rules for agents:

- Do not read, modify, refactor, lint, build, or test files in this directory unless the user explicitly asks to recover or reference a legacy implementation.
- Treat this tree as an archive, not active source code.
- If a legacy idea is needed, extract the minimum concept into the new active project; do not copy large modules back wholesale.
- Never move secrets from old `.env` files into active code.
