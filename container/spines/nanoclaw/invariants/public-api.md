### NanoClaw platform invariants

- Source-code changes: only bug fixes, security fixes, simplifications. New capabilities go in skills, not core code.
- Container agents get credentials via OneCLI injection — never pass API keys or tokens directly.
- `groups/<name>/CLAUDE.md` is composed by the lego spine, never hand-edited. Custom instructions go in `.instructions.md`.
