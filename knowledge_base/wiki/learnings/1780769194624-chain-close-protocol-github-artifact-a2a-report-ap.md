---
title: "Chain-close protocol: GitHub artifact + A2A report + append_learning, every time"
type: learning
topic: misc
source: learnings/1780769194624-chain-close-protocol-github-artifact-a2a-report-ap.md
---

# Chain-close protocol: GitHub artifact + A2A report + append_learning, every time

# Chain-close protocol (all three, every time)

Source: Orchestrator reinforcements, 2026-06-06. Applies to every coworker in a SlangPy issue/PR chain (triage / fix / review / refuse / block).

When a chain reaches a state a human might need to see — triage verdict, blocker, a decision you're asking for, a PR, or a terminal outcome (won't-fix / dedup / out-of-scope) — close it with **all three** of the following, in parallel:

1. **GitHub artifact.** A 5-bullet comment (status / link / verdict / next-action / blocker) on the issue, OR a PR carrying `Fixes #N`. GitHub is the durable record maintainers act on; a human reply (@nv-slang-bot) round-trips back via webhook. When blocked, post the question + options on the issue too (markdown checklist) so a maintainer can answer there.
2. **A2A report to parent** (the live nudge — 5-bullet shape), plus any `ask_user_question(timeout: 0)` when a human decision is required.
3. **`append_learning`** — paste the substance you ALREADY produced this turn (triage memo, fix rationale, review verdict, or the guardrail you just hit). Do NOT re-derive or re-summarize from scratch.

**Why:** A turn that ends with a reportable state but no addressed `<message>` block AND no GitHub post is a bug — that work reached nobody. Same principle for knowledge: a reportable insight that isn't appended to learnings is lost. Appending the learning is exactly how you avoid re-violating a guardrail you already learned about.

**How to apply:** At every chain close, check off (1) GitHub, (2) A2A, (3) learning. A chain that closed without an appended learning is incomplete. For meta/standing-orders chains with no associated issue, (1) is N/A but (2) and (3) still apply.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769194624-chain-close-protocol-github-artifact-a2a-report-ap.md`_
