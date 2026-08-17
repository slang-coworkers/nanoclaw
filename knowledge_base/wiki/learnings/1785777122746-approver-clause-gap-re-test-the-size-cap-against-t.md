---
title: "[approver/clause-gap] Re-test the size cap against the NEW TOTAL after a vendored-blob removal — not the delta"
type: learning
topic: review-approval
source: learnings/1785777122746-approver-clause-gap-re-test-the-size-cap-against-t.md
---

# [approver/clause-gap] Re-test the size cap against the NEW TOTAL after a vendored-blob removal — not the delta

**Symptom:** slang-rhi#803 R1/R2 failed `tier_eligible` at 12,754 LOC, of which 9,376 was a single vendored third-party header (`external/tinybvh/tiny_bvh.h`). At R3 the author de-vendored it to a submodule gitlink (answering a maintainer's review ask), removing −9,376 lines. The intuitive read — "the blocking bulk is gone, so the cap must clear now" — is WRONG: the new total is **3,391 LOC**, still 1.70x over the 2,000 cap. Same clause, same short-circuit, same ABSTAIN_POLICY.

**Root cause:** Reasoning about the *delta* instead of re-evaluating the *predicate*. A size cap is a threshold on a total, so any change to the diff invalidates the prior evaluation in BOTH directions — a removal can leave you still over, just as an addition can push a previously-passing PR over. The prior row's evidence string ("12,754 lines changed > cap 2000") describes a revision that no longer exists; inheriting it would be citing a stale basis even though the disposition happens to be unchanged.

**How to catch it:** On every new head, re-run the clause evaluator and read the LOC figure it computes for THAT head. Never carry a size-cap evidence string forward across revisions, and never predict cap clearance from "the big file is gone" — subtract and compare explicitly. Cheap check: `gh pr view <n> --json additions,deletions,changedFiles`. Corollary worth noting in the row: after de-vendoring, the cap fires on the PR's own hand-written code rather than third-party bulk, which is a materially different (and more legitimate) reason for the same abstain — worth saying out loud so a human doesn't dismiss it as "just the vendored blob again."

**Two adjacent traps hit in the same round:**
1. **A retiring *reinforcing* reason doesn't move the verdict — but must stop being relayed.** My R1/R2 rows cited "fork PR CI never ran (`action_required`)" as reinforcement. By R3 that was STALE: CI was running (17 success / 2 in_progress / 0 failures) because fork `action_required` checks start once a maintainer approves the run. The verdict stood on the size cap alone, so nothing changed — but re-relaying a dead reason misleads the human. Re-verify each reinforcing reason at the new head, and explicitly retire the ones that die. (The other reason — feature compiles out ⇒ green builds are zero coverage of the new code — was re-verified and HELD; that's the non-obvious half worth keeping.)
2. **`gh pr view --json reviews` strips the `[bot]` suffix.** It renders `coderabbitai[bot]` as plain `coderabbitai`, so an `endswith("[bot]")` bot-filter returns a FALSE NEGATIVE and a bot review can be miscounted as a human one — which matters directly, since "is there a non-bot review?" drives `mode=live`/`live_late` and whether a human blocker exists. Use GraphQL `__typename: Bot`, or the REST `issues/<n>/timeline` (which does carry `type: Bot` and the suffixed login), as the discriminator.

**Fix:** Recorded R3 as a fresh ledger row (ledger keys on commit_sha) with the re-computed 3,391 basis, the retired reason marked stale, and the surviving compile-out reason re-verified at the new head. A metadata-only clause FAIL does not require re-running the ~10min harvest+Devin cycle — but the numbers it rests on must be re-derived, not assumed.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785777122746-approver-clause-gap-re-test-the-size-cap-against-t.md`_
