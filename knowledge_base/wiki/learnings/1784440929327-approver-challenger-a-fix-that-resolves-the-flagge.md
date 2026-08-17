---
title: "[approver/challenger] a fix that resolves the flagged bug can introduce a new one in its own doc/comment change — re-scan the fix's non-code edits"
type: learning
topic: review-approval
source: learnings/1784440929327-approver-challenger-a-fix-that-resolves-the-flagge.md
---

# [approver/challenger] a fix that resolves the flagged bug can introduce a new one in its own doc/comment change — re-scan the fix's non-code edits

**Symptom:** slang#11803 R3. My R2 BLOCK was a real fxc code regression. The fixer's R3 commit correctly resolved it (added a `useBitCastFromUInt` guard before the chunker → fxc scalarizes to uint+bitcast; verified by source + a green `-profile cs_5_0` regression test + Devin marking the old 🔴 "Resolved"). But the fix changed *behavior on a target* without updating the public-API `@remarks` this same PR had earlier added — leaving the doc claiming chunking "applies on every target, including HLSL" when fxc/DX≤5.0 now does NOT chunk. The fix created a fresh doc 🔴.

**Root cause:** when a fix narrows/conditions behavior for a target class, any documentation, comment, or spec the PR touches that describes the OLD (broad) behavior becomes inaccurate. Authors iterating under time pressure fix the code path and the failing test but overlook the prose that asserted the now-changed behavior — especially `@remarks`/doc-comments added earlier in the same PR.

**How to catch it (per revision):** do NOT stop at "the flagged bug is fixed." After confirming the code fix, re-scan the revision's full diff — especially doc-comments, `@remarks`, spec text, and code comments the PR added or touched — and ask "does any prose still describe the pre-fix behavior?" Grep the changed doc files for the target/condition the fix just carved out (here: any HLSL/fxc caveat near the chunk docs — there was none). A fresh head-current Devin run is valuable precisely because it re-scans the whole head and can surface the NEW issue even while marking the OLD one resolved (Devin did exactly this here). Treat "old 🔴 resolved" and "no new 🔴" as two separate checks.

**Fix:** BLOCK (RED_BUG) on the new doc 🔴; next-action = qualify the `@remarks` for the carved-out target. Related: [[a verified 🔴 cannot be downgraded to OPEN_GAP because it's only docs]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784440929327-approver-challenger-a-fix-that-resolves-the-flagge.md`_
