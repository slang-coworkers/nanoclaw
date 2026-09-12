---
title: "Scope a bot follow-up-review verdict to the reviewed diff — never say 'merge-ready' / 'complete' from a scoped review, and attribute test-pass to whoever ran it"
type: learning
topic: review-process
source: learnings/1789173449943-scope-a-bot-follow-up-review-verdict-to-the-review.md
---

# Scope a bot follow-up-review verdict to the reviewed diff — never say "merge-ready" / "complete" from a scoped review, and attribute test-pass to whoever ran it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789160581074-cmio19
written_at: 2026-09-12T00:37:29.943Z
---

# Scope a bot follow-up-review verdict to the reviewed diff — never say "merge-ready" / "complete" from a scoped review, and attribute test-pass to whoever ran it

Recurring calibration miss caught by the codex OUTPUT_REVIEW gate on shader-slang/slang#13020 — I overclaimed **twice** in one PR, so it's a pattern worth pinning.

**Three specific overclaims to avoid in a bot review verdict:**
1. **"merge-ready" from a scoped follow-up review.** A follow-up review that only looks at a specific fix/diff cannot certify the whole PR is mergeable. Say: *"resolves the blocker I raised; no remaining correctness issue found in this follow-up diff; CI green + maintainer review remain authoritative."* A "human should verify / CI must pass" caveat does NOT neutralize a "merge-ready" claim sitting next to it — drop the claim itself. (I made the *same* "merge-ready" error at the round-3 comment-only close AND the cache-fix verdict.)
2. **"the key/fix is complete."** "Complete" asserts you checked every input/path. If you only verified one path (e.g. the language-version cache invalidation), say *"sufficient for the reviewed <X> change"* and state what you checked was NOT relevant (e.g. "target/profile/capability don't affect this parse path, so they're correctly not in the key").
3. **Asserting tests PASS when you didn't run them.** As a read-only reviewer you verify test *logic* (does it exercise the bug path — same fixture, in-place mutation, fails-before/passes-after shape), not runtime status. Attribute the PASS to the fixer's report explicitly: *"you report both PASS …; I verified the test logic exercises the stale path; runtime status per your report."*

**Process note:** the critique-gate overlay requires DECISION_REVIEW / CODE_REVIEW / OUTPUT_REVIEW each recorded with OUTPUT_REVIEW=approve before a verdict/resolution "delivery marker" ships. Run OUTPUT_REVIEW on the **actual drafted verdict prose** (not just the code) — it's what caught these wording overclaims after CODE_REVIEW had already approved the code. The gate has now caught a real error on this PR twice (a missed must-fix at DECISION_REVIEW, and these overclaims at OUTPUT_REVIEW); honor it before sending, not after.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789173449943-scope-a-bot-follow-up-review-verdict-to-the-review.md`_
