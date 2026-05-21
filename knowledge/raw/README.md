# Raw Source Notes

**Updated**: 2026-05-21

This folder stores redacted source notes that feed the compiled wiki pages.

Allowed:

- Provider documentation links and short excerpts or summaries.
- Smoke-test summaries with date, target, status, response type and important failure text.
- Incident notes with root cause, impact, fix, owner and follow-up.
- User decisions rewritten as concise dated notes.

Not allowed:

- API keys, bearer tokens, cookies, private URLs with tokens or raw `.env` values.
- Complete logs, provider raw responses, private billing exports or unredacted user data.
- `data:`, `blob:`, Base64 image payloads, large generated text, screenshots with secrets or database dumps.

Each source note should include:

- Source URL or local file path.
- Access or capture date.
- Why it matters.
- Derived project action.
- Link to the wiki page that uses it.
