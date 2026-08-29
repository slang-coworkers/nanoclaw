---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787679838053-tefesj
written_at: 2026-08-28T22:55:55.122Z
---

# [approver/human-disagreement] BLOCK on a NON-GATING nightly regression overruled by merge — weight a CI signal by whether it gates merge, and whether the consequence was already surfaced to the merger

**Outcome.** slang#12717 R2 @e145e45d1245: I decided **BLOCK** (reason: removing the `/dev/null` carve-out regresses ~972 nightly-Linux `docs/generated/tests` files). jkwak-work (MEMBER, the feature requester) **merged at my exact decided head** on 2026-08-28 (merge commit 28c755b0). merged ⇒ APPROVED-equivalent ⇒ overruled my BLOCK.

**My mechanism was factually correct — this was not a false analysis:** verified at the merged tree that 972 `docs/generated/tests` `.slang` files use `-o /dev/null`, the guard rejects `/dev/null` on all hosts, the `-test-dir` discovery path reaches the guard (`runTestsInDirectory → _runTestsOnFile → _gatherTestsForFile → _normalizeTestOutputPaths`), `_common.md` still mandates `/dev/null`, and `expected-failures.txt` does not absolve those files. So the nightly WILL likely see failures.

**Where my SEVERITY judgment was mis-calibrated — the transferable lesson:**
1. **Weight a CI signal by whether it GATES merge, not just by blast radius.** The affected tree runs in `nightly-slang-test.yml`, which is (a) **not a required/gating check** on the PR and (b) **already intermittently red and actively triaged** — 4 of the 6 nightly runs around the merge failed, and the team manages known failures via `expected-failures.txt` (which itself lists unrelated ongoing failures like #12442). A regression on a non-gating, human-triaged nightly is a **post-merge cleanup item the maintainer can accept and defer**, not a merge-blocker. I treated "972 tests would go red on the nightly" as BLOCK-worthy when the maintainer's actual bar is "does it break a gating check?" A large count on a non-gating lane ≠ high severity.
2. **A consequence the merger was already shown, in-thread, and chose to proceed on, is a KNOWING ACCEPTANCE — not a gap to BLOCK on.** The review bot had laid out this exact ~972-file consequence to jkwak-work on 08-26 (blast-radius table + fold-in-vs-prerequisite options); jkwak-work engaged ("please address the failing tests", 08-27) and merged anyway. When the person who will merge has explicitly seen the consequence and steers ahead, the approver's BLOCK is second-guessing a made decision. The right shape there is likely **ABSTAIN_POLICY (OPEN_GAP / a human must weigh the nightly-migration tradeoff)** — which does not assert "this must not merge" — rather than BLOCK, which claims a verified merge-blocking defect.
3. **BLOCK should be reserved for a defect on a GATING path or a correctness bug in shipped behavior.** "Breaks an off-per-PR, non-gating, already-triaged nightly lane" is real and worth flagging, but it is a severity-of-ABSTAIN concern, not a BLOCK. The R1 BLOCK (broke the Windows EVERY-PR gating leg) was correctly a BLOCK; R2's nightly regression was not the same class.

**Probe to add to Step-3 challenger for any CI-break BLOCK:** before calling a CI regression a BLOCK, resolve (a) is the affected workflow a REQUIRED/gating check on this PR? (b) is that lane already red / actively triaged via an expected-failures mechanism? (c) has the consequence already been surfaced to the likely merger, who engaged? If the lane is non-gating AND (already-triaged OR the merger was shown and proceeded), downgrade BLOCK→ABSTAIN(OPEN_GAP).

**Ground truth still pending:** the first post-merge nightly (~08-29 04-06Z) had not run at record time; whether it actually reddens on the `/dev/null` files (and whether the team then triages them into expected-failures or a follow-up migrates the docs idiom via #12334-style) is the confirming datapoint. Re-check the 08-29 nightly.
