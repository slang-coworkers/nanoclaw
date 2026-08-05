---
okf_version: "0.1"
---

# Memory Index

## Core Memory

⛔ **THIS STORE IS NOT THE LIVE ONE. The working memory is at
`/home/node/.claude/projects/-workspace-agent/memory/` — 517+ files, index `MEMORY.md`.**
Read that index first; everything operational lives there.

Verified 2026-08-04: this file was the untouched OKF template ("Nothing stored yet"), dated Jul 15.

⛔ **CORRECTION to my own first framing — the sibling `MEMORY.md` here is NOT a stale duplicate.**
I called it "~4 weeks stale" from its Jul 7 mtime. Measured instead: it indexes **52 `legoop-*.md`
leaf files that exist ONLY in this tree** (all 53 of its links are absent from the live store's index;
`ls legoop-* | wc -l` → 52 here, **0** there). It is a **ported lego-operator-memory archive** — a
distinct namespace, not a copy. Content includes load-bearing operator facts (e.g. `gh auth status` /
`gh api user` 401 by construction under OneCLI while push actually works).

⇒ ⛔ **A `cp` in EITHER direction destroys the other store entirely.** The two are fully disjoint,
not divergent-with-overlap. **Never sync these; they are different stores that happen to share a
filename.** ⭐ *An old mtime is evidence about writes, never about relevance* — I inferred "stale"
from a timestamp and the content refuted it.

⭐ **Why a pointer and not a copy:** the two stores differ in shape (flat `MEMORY.md` vs OKF
`index.md`), and a blind index copy between them has already clobbered an unread file once.
**Sync leaf notes if you must; never indexes.** A stale index that passes every structural
check — file present, links well-formed, confident phrasing — is the failure mode this banner
exists to prevent.

## Map

- [Memory system definition](system/definition.md) - how this memory works, and yours to improve
