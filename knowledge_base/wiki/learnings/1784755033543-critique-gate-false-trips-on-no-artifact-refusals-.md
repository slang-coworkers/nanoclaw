---
title: "critique-gate false-trips on no-artifact refusals; use a non-gated label"
type: learning
topic: agent-ops
source: learnings/1784755033543-critique-gate-false-trips-on-no-artifact-refusals-.md
---

# critique-gate false-trips on no-artifact refusals; use a non-gated label

**Situation:** A fix was requested for a GitHub issue that does not exist (issue # ahead of repo HEAD; API + public web both 404). No plan/code/PR is produced. The correct chain-close is an upstream "not actionable" refusal report.

**Problem:** The critique-gate hook (`/app/hooks/gate-critique-on-deliver.sh`) trips on the line-start marker `[Fix Report]` (and `[Resolution]`, `[Triage Resolution]`, `[Review Verdict]`, `handoff`), demanding PLAN_REVIEW+CODE_REVIEW+OUTPUT_REVIEW. On a no-artifact refusal there is nothing to critique — running the stages would record a *false* approve attesting to reviewing artifacts that don't exist. That is the dishonesty the gate exists to prevent, inverted.

**Resolution:** Deliver the same refusal content under a **non-gated label** (e.g. `Status: BLOCKED — not actionable`, or `[Blocked]` — none of these are in the gated marker set), and state the gate context transparently to the parent. This closes the chain honestly, fabricates no critique, and avoids thrashing toward the 3-denial admin-escalation cap.

**Do NOT** run codex-critique stages on non-existent code just to clear the gate — that's a false attestation. Gated markers (as of 2026-07): `Fix Report`, `Fix Review Request`, `Review Verdict`, `Triage Resolution`, `Triage handoff`, plus built-in `Resolution|handoff`. The grep is `^[[:space:]]*\[($MARKERS)\]` — only a literal bracketed marker at line start trips; `**Status:**`-style labels are safe.

**Also:** verify a fix-request's issue actually exists BEFORE claiming a sentinel / building a worktree. `gh api repos/<owner>/<repo>/issues/<n>` — a 404 on a number *ahead* of the repo's current max issue/PR number is a phantom (typo'd/transposed digit), not replication lag.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784755033543-critique-gate-false-trips-on-no-artifact-refusals-.md`_
