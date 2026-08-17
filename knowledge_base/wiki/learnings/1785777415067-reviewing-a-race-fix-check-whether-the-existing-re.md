---
title: "Reviewing a race fix: check whether the 'existing regression guards' are actually enabled"
type: learning
topic: review-process
source: learnings/1785777415067-reviewing-a-race-fix-check-whether-the-existing-re.md
---

# Reviewing a race fix: check whether the "existing regression guards" are actually enabled

**The mistake, concretely.** Reviewing shader-slang/slangpy#1073 round 1, I APPROVE'd a +14/−5 lock-free reorder partly because the handoff cited two existing tests that "already encode the fixed expectations." I verified they *existed* at the right line numbers and that the PR didn't modify them. I never checked whether they *ran*. Both were `doctest::skip()`-disabled on main by an earlier PR (#1076) with the comment `// TODO: Re-enable when #1073 is merged`. The profiler's author then reviewed and found the reorder didn't address the underlying synchronization defect at all; the PR grew to 8 commits / +205−13.

**Rules I'd apply next time:**
1. **"Test exists" ≠ "test runs."** For any cited guard, grep the test *declaration* for skip/disable markers, not just the assertions: `doctest::skip()`, `DISABLED_` (gtest), `@pytest.mark.skip`, `#if 0`, `GTEST_SKIP()`, early `return;` behind a capability check. A skipped test is worse than a missing one — it reads as coverage.
2. **A PR that changes zero test lines while claiming test coverage deserves suspicion.** `git diff base..head -- <testfile>` returning empty is a finding, not a reassurance. Ask *why* no test was needed, and whether the cited guard can even fail.
3. **For race fixes specifically, demand the positive control:** revert the fix alone, show the test failing. A green suite proves nothing about a fix for a window the scheduler may not enter. When the fixer supplies positive controls (this one did in round 2, with per-defect revert symptoms), that is the single most valuable part of the handoff.
4. **Beware vacuous assertions in race tests.** Round 2's fixer self-reported two: an assertion on `parent_index == -1` that passed either way because the parent lookup read the same zeroed slot, and `producer_drop_count == 0` which could never hold since the out-of-order end itself bumps the counter. Also: two tests had to be *split* because one's retry sequence masked the other's defect. When reviewing a race test, ask "what is the ONLY externally visible symptom of this bug, and does the test assert exactly that?"

**Also reusable — bounding a "gate could stall forever" concern.** When a completion gate can block a FIFO (`break` on unmet condition), don't stop at "is the condition always met?" Look for a force-release valve and check its call frequency. In this profiler, `bound_pending_frames()` clears the expectation on window overflow and runs on *every* frame marker consumed, so any stall is bounded by the window size rather than permanent. That converts a scary finding into a nit, and it's the argument the PR body should lead with.

**And: bound wrap-based "formal holes" by physical reachability before reporting them as defects.** An adversarial reviewer (codex) flagged a duplicate-correlation-id stall and an ABA double-release, both requiring a 32-bit `timeline_id` wrap. The id vector is never shrunk and each entry is ~459KB (8192 × 56-byte event), so 2^32 entries is ~2 exabytes of live allocation. Real in the standard, unreachable on hardware ⇒ document-only nit, not a bug. Compute the resource cost before escalating a wrap scenario. Corollary: an `SGL_ASSERT` on something arithmetically guaranteed by the construction (here `correlation_id != 0`, since the high half is `timeline_id + 1` and the low half starts at 1) is noise — comment the *why* instead so a future layout change can't silently break the sentinel.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785777415067-reviewing-a-race-fix-check-whether-the-existing-re.md`_
