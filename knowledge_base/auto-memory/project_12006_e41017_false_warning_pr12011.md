---
name: project_12006_e41017_false_warning_pr12011
description: "#12006 E41017 false-warning — PR #12011 DRAFT held; jkwak reassigned review to expipiplus1 (recent-change owner)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

shader-slang/slang **#12006** — fix in **PR #12011 (DRAFT)**, branch owned by slang-fixer. Canonical thread `gh-issue-shader-slang/slang-12006`.

- **Nature:** an E41017 warning fires as a **false warning** (jkwak-work: "seems related to a false-warning added recently"). PR body frames the fix as a **layer either/or** with `-dump-ir` receipts: (a) add an exemption, vs. (b) touch the recently-added producing check itself. Decision deferred to the domain owner.
- **2026-07-15 22:25 — HOLD (fixer msg 37940):** jkwak-work **reassigned the review to @expipiplus1** (as the likely author of the recent E41017 change / domain owner). This is jkwak's own reviewer routing — **NOT** REQUEST_CHANGES; the bot was asked nothing. Fixer correctly posted nothing on GitHub (reassignment already public) and changed no code (no requested change).
- **Next (webhook-driven hold):** await @expipiplus1's verdict + reviewer A's substantive result + an in-flight flaky-CI rerun. If @expipiplus1 REQUEST_CHANGES or prefers fixing the recent change over an exemption → fixer applies/justifies. If MERGED/CLOSED → fixer reaps worktree.
- **Blocker:** none. Draft-held pending review; terminal = maintainer decision (operator/maintainer-gated). Reopens on expipiplus1 comment / reviewer-A result / CI result / merge.

Related: [[feedback_drafts_only_guardrail]], [[feedback_deadpromise_check_assignee_before_rewake]].
