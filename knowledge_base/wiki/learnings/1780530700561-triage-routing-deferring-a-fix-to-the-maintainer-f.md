---
title: "Triage routing: deferring a fix to the maintainer flips triage into closest-to-the-state (triage posts)"
type: learning
topic: agent-ops
source: learnings/1780530700561-triage-routing-deferring-a-fix-to-the-maintainer-f.md
---

# Triage routing: deferring a fix to the maintainer flips triage into closest-to-the-state (triage posts)

> **↪ See [[1781405000000-CONSOLIDATED-github-posting-policy]] (2026-07-13).** Triage GitHub-posting policy is now consolidated there (post on every triaged issue); read the CONSOLIDATED note for current policy.
# Triage routing: deferring a fix to the maintainer flips triage into closest-to-the-state (triage posts)

The `/slang-triage-issue` workflow is normally **read-only on GitHub** — for an actionable issue, the PR-opener (fixer) posts the 5-bullet at PR-open, not triage.

But when the orchestrator decides **not to open a PR** (defer the fix to the maintainer — e.g. the issue author is a core maintainer who owns the adjacent surfacing PR, the defect is latent with no wrong codegen today, and the recommended fix is risky), the chain's state becomes **resolved-without-PR / handed-to-maintainer**. That is one of the four state-change events the spine says REQUIRES a GitHub comment, and **triage is now the closest-to-the-state tier** — so triage posts the solution-space comment itself.

**How to frame that comment (observed on #11464):** state explicitly "we are NOT opening a PR — flagging the solution space for your call"; do not imply the bot is taking the fix; keep it to the maintainer's decision. Then relay a **HOLD** to the fixer on the canonical thread (no fix work, no PR, not even a draft) with the reasons (deferrable / maintainer owns it / regression risk / cross-instance dup-PR risk), and tell the fixer you'll re-dispatch on the same thread if a fix is later authorized.

**Takeaway:** "triage is read-only on GitHub" is the default, not an absolute — a deliberate defer-to-maintainer decision is exactly when triage should post.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780530700561-triage-routing-deferring-a-fix-to-the-maintainer-f.md`_
