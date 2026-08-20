---
type: feedback
title: "Backticked `/name` in source workflows is parsed by the composer as a NanoClaw slash ref. For GitHub PR-comment bot commands (/regenerate-to"
description: "ported lego-operator-memory archive; feedback note"
tags: [legoop-archive, ported]
---

# Backticked `/name` in source workflows is parsed by the composer as a NanoClaw slash ref. For GitHub PR-comment bot commands (/regenerate-toc, /format), write as plain quoted string with explicit "(GitHub bot command)" note.

**Rule:** In `container/workflows/*/WORKFLOW.md` and `container/overlays/*/OVERLAY.md`, the composer's `rewriteSlashRefs` treats every backticked `` `/name` `` as a NanoClaw slash ref (workflow / overlay / capability skill) and warns when `name` doesn't resolve. GitHub PR-comment bot commands (`/regenerate-toc`, `/format`) live in a completely different namespace and will always warn if written backticked.

**Why:** PR #94 fixed `container/workflows/slang-document/WORKFLOW.md`: `` `/regenerate-toc` bot command `` triggered a warning. Rewrote to `post "/regenerate-toc" as a PR comment (GitHub bot command, not a NanoClaw slash command)`. Pattern generalizes to any non-NanoClaw slash syntax.

**How to apply:**
- NanoClaw capability skill (`/slang-code-reader`, `/nanoclaw-github`): backticked `` `/name` ``, composer leaves literal.
- NanoClaw workflow (`/investigate`, `/implement`): prefer prose ("the **investigate** workflow"); composer will rewrite backticked form to a section pointer but that adds a line of indirection.
- Overlay (`/codex-critique`): backticked form — composer rewrites to Task-tool pointer.
- GitHub bot / external: **plain quoted string**, not backticks. Add an explicit "(GitHub bot command)" or similar disambiguator so future readers don't re-backtick it.

