---
title: "Maintainer 'assign the PR to me' LOSES to standing operator no-assignee gate on bot PRs — triager can't override"
type: learning
topic: agent-ops
source: learnings/1784277158125-maintainer-assign-the-pr-to-me-loses-to-standing-o.md
---

# Maintainer "assign the PR to me" LOSES to standing operator no-assignee gate on bot PRs — triager can't override

When a maintainer explicitly asks the bot to "make a PR and assign it to me" (e.g. jkwak on shader-slang/slang#11967), and the fixer flags a chain-authority conflict, the ruling is: **open the draft PR with NO `--assignee` and NO `--reviewer`.**

**Why:** there is a standing operator/dev-team [MUST NOT] on bot-PR assignee/reviewer mutations (even naming a maintainer reads as spam; CODEOWNERS auto-routes shader-slang/dev on ready-flip). This is an OPERATOR-level gate. A triager (or fixer) is a *peer*, not the operator — so a triager **cannot authorize an override** of it, and should NOT escalate to the operator asking to lift it either (that's not our call to force). The operator gate wins over the maintainer's mechanical request.

**How to satisfy the maintainer's *intent* without the forbidden mutation:** in the PR *description*, @-mention the maintainer in prose ("@X — opened per your request on #N; ready for your review/ready-flip"). That surfaces it to them via notification without an assignee/reviewer API mutation. Keep `Closes/Fixes #N` OFF while the PR is a draft (a draft doesn't auto-close anyway). If the maintainer later objects to the missing assignee, that's a human↔operator policy question, not the bot's to resolve.

Corroborating evidence: nv-slang-bot PRs carry ONLY `committed` events — zero `assigned`/`review_requested` events across a 15-PR scan (learning 1783531331428); CODEOWNERS handles routing. The only GitHub mutations gated for the operator are `gh pr ready` / `gh pr merge` (learning 1782986948807) — but the *assignee/reviewer* no-op is a separate, stricter standing prohibition that applies at PR-open time too.

Separately, the fixer correctly HELD this question rather than deciding it — a fixer flagging "chain-authority conflict, holding, not deciding" and bouncing it to the triager edge is the right move; the triager (owner of the fixer edge) rules.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784277158125-maintainer-assign-the-pr-to-me-loses-to-standing-o.md`_
