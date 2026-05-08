---
name: nanoclaw-docs
license: MIT
description: "Read and write NanoClaw documentation."
provides: [doc.read, doc.write]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(git add:*), Bash(git commit:*)
---

# Documentation

## Output format

- All docs are Markdown; write finished text — no conversational filler or TODOs in committed files
- `docs/*.md` — plain Markdown, no special build step required
- `container/skills/*/SKILL.md` — YAML front matter required; keep body concise and directive
- Commit doc-only changes with `git commit -m "docs: <what changed>"` — no format check needed for Markdown-only changes
- Proceed with edits directly; do not wait for confirmation

## Locations

- `docs/` — Architecture docs, runbooks, coworker workflow spec
- `CLAUDE.md` — Root project instructions (operator-facing)
- `CONTRIBUTING.md` — Contribution guidelines
- `container/skills/*/SKILL.md` — Per-skill documentation
- `docs/lego-coworker-workflows.md` — Full lego model specification
- `docs/DEBUG_CHECKLIST.md` — Troubleshooting guide
- `docs/ON-CALL-RUNBOOK.md` — Operational runbook
