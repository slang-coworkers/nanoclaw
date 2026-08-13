---
name: project_slang_pages_liquid_generated_docs
description: "shader-slang/slang GitHub Pages/Jekyll build broke ~5 days (self-perpetuating on every master landing) from an unescaped Liquid {{ in a GENERATED coverage README. Dispatched to slang-fixer 08-12 08:19; dispatch STALLED (woke once, no PR, dark ~8.5h); I chased it (owned-chain rule) → fixer delivered producer-layer fix draft PR #12511. Verified live."
metadata: 
  node_type: memory
  type: project
  originSessionId: ae9ebb4b-ce3f-4ec1-ba66-0eb834d293af
---

# slang Pages/Liquid generated-docs break — dispatched, stalled, chased, delivered

**Surfaced 2026-08-12 by slang-discord-support's CI heartbeat** (a recurring flag, ~114h→125h across ticks): GitHub Pages/Jekyll build failing ~5 days, self-perpetuating on every master landing. Root cause: `docs/generated/tests/coverage/lower-to-ir/README.md:133` contains `float2x2 m = {{1,2},{3,4}}` — the front-matter'd generated README is Liquid-processed, `{{` opens an output tag, Liquid's non-greedy `}}` scan stops at the first single `}` → unterminated tag → whole site build aborts. Landed on master 08-07 via #12409.

**I verified the break live at master before dispatching** (read the file; confirmed the `{{`; confirmed frontmatter `generated: true` / "Do not edit by hand" ⇒ producer fix, not artifact hand-patch).

## ⭐⭐⭐ The load-bearing lesson: I OWNED this chain, the dispatch STALLED, and chasing (not assuming self-heal) is what closed it.

Timeline:
- **08:19Z** dispatched to `slang-fixer` on fresh thread `docs-pages-liquid-escape-lower-to-ir`, producer-first framing (fix the doc generator to escape `{{`/`{%`, then regenerate; grep siblings), verify-before-fact.
- **08:21Z** fixer session `sess-1786522882944-tavoyq` woke — but its **only outbound was a leaked scratchpad fragment** ("Now fix the glossary line in the PR body…") referencing a PR that **did not exist**, then went dark. `container_status=stopped`, `last_active=08:21`, no PR, no report for ~8.5h.
- **19:18Z** the heartbeat re-flagged the break still live (~125h). ⇒ ⭐⭐⭐ **"still broken" on a chain I own is the trigger to CHASE, not to assume the dispatch is progressing.** I checked: (a) the session's transcript tail (only the scratchpad fragment), (b) GitHub's 15 most-recent open PRs (NONE touched the Liquid/README fix) ⇒ **dispatch confirmed stalled**, not slow.
- **19:18Z** re-drove on the canonical thread, **pinned to the existing session** (`target_session_id=sess-1786522882944-tavoyq`) so it resumed with context rather than cold, demanding one of two outcomes: draft PR (generator fix + regenerate) OR a blocker report.
- **19:53Z** fixer delivered **draft PR #12511** `docs/generated: stop generated test READMEs from breaking the Pages build` (head `fix/pages-liquid-generated-docs`, `pr: non-breaking`, assignee jvepsalainen-nv). **Verified live.**

## The fix (verified in the PR body) — producer-layer, exactly as scoped

- New `lint_liquid_safe` hard-gate in `regenerate.py` (rejects raw `{{`/`{%` in bundle README bodies) + 5 selftest checks; wired into `check-doc-gaps.yml`'s existing `regenerate.py lint` PR gate ⇒ a reintroduction now fails CI.
- Prompt rule in `_common.md` teaching the generator two **dual-render-safe** spellings (the READMEs render on BOTH github.com GFM — no Liquid — AND Pages — Liquid — so `{% raw %}`/backtick-entity escapes were rejected because they'd show literally on github.com).
- All **3** raw `{{` fixed: the fatal initializer → spaced braces `{ {1,2},{3,4} }` (whitespace-irrelevant Slang); two FileCheck-wildcard docs → `<code>&#123;&#123;…&#125;&#125;</code>` (renders as literal `{{…}}` on both surfaces).
- ⭐ **Honestly disclosed an adjacent out-of-scope hazard**: the separate `docs/generated/design/**` tree has 8 raw `{{` (all *terminated* FileCheck wildcards, so they render empty rather than abort — NOT part of this outage), left for a follow-up that mirrors the guard into the design driver. Did NOT claim repo-wide prevention.

## State / triggers
- PR #12511 held as **draft** (bot policy — a maintainer flips it ready → real `pull_request` CI incl. the `check-doc-gaps` gate the fix passes). Reviewer dispatched. Webhook-driven from here.
- Chain closed on my side: dispatched → stalled → chased → delivered → verified. No further action unless a webhook/reviewer surfaces something.
- ⚠ The separate `design/**` `{{` hazard is a real (non-fatal) follow-up; if a future Pages break recurs from that tree, #12511's PR body has the analysis.
