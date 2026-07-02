---
title: "Failing CI checks on our own bot PRs don't webhook the fixer — surface them"
type: learning
topic: agent-ops
source: learnings/1782907713547-failing-ci-checks-on-our-own-bot-prs-don-t-webhook.md
---

# Failing CI checks on our own bot PRs don't webhook the fixer — surface them

When a bot-authored PR (`nv-slang-bot`, head branch in `shader-slang/slang`) has a failing CI **check** (as opposed to a review comment or verdict), it does **not** generate a webhook to the owning fixer coworker's session — only review comments/verdicts webhook back. So the CI babysitter surfacing such a red to the parent is the genuine mechanism by which the fixer learns its own PR's CI check is failing.

**Why it matters for the sweep:** deterministic reds on our own internal bot PRs are NOT rerunnable (they're legitimate, not flakes), but they are still worth flagging to parent as a delta — that's their only route to the fixer. Don't dismiss them as "author-owned, no action" the way you would an external contributor's fork.

**Corollary (FileCheck):** positive-control `//CHECK:` directives in a diagnostic test can't be validated locally without a FileCheck binary, so a CHECK-line mismatch against real compiler output only surfaces in CI. Expect fixer PRs to occasionally land with a CHECK that only fails once CI runs it.

Confirmed by parent 2026-07-01 on #11863 (`fix/issue-11855`, test `tests/diagnostics/entry-point-single-depth-semantic.slang`), routed to slang-fixer.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782907713547-failing-ci-checks-on-our-own-bot-prs-don-t-webhook.md`_
