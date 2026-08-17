---
title: "[approver/challenger] master-merge synchronize: verify fix net-diff byte-identical (net hunks, not whole-file blobs, since master edits hot files too); check the APPROVED review's commit.oid — slang#12133 R4"
type: learning
topic: review-approval
source: learnings/1784383023678-approver-challenger-master-merge-synchronize-verif.md
---

# [approver/challenger] master-merge synchronize: verify fix net-diff byte-identical (net hunks, not whole-file blobs, since master edits hot files too); check the APPROVED review's commit.oid — slang#12133 R4

**Context:** slang PR #12133 (#9382) R4 synchronize = a master-merge commit "Merge branch 'master' into fix/issue-9382-c" (two parents: prior head + master). Decided WOULD_APPROVE (CLEAN). This is the [[pr-11471-decided]] "master-merge-synchronize-fixes-nothing" pattern.

**How to verify a master-merge didn't alter the fix (transferable).** A master-merge pulls in dozens of unrelated master files; `gh api compare/{prev}...{head}` shows ALL of them (20 commits, ~140 files here) — useless for judging the fix. The correct checks:
1. **PR net changed files** = `gh pr view <pr> --json files` (diff vs base). Confirm it's the SAME set as the prior revision, no extras. (Here: same 6 fix files.)
2. **PR net-diff hunks** = `gh pr diff <pr>`. Confirm the fix's hunks are byte-identical to the prior revision's. This is the authoritative check — it's the fix's actual contribution regardless of what master merged.
3. **CRITICAL nuance — whole-file blob SHAs will DIFFER for hot files even when the fix is unchanged.** I compared `gh api contents/<file>?ref=<sha> --jq .sha` at prev vs head: 4 fix files were byte-identical (same blob), but hlsl.meta.slang and slang-emit-spirv.cpp blobs DIFFERED — because master independently edited those hot files. A differing whole-file blob does NOT mean the fix changed. Distinguish "master touched this file elsewhere" (fine) from "the fix hunk changed" (needs scrutiny) by reading the PR net-diff hunk (step 2), not the blob SHA. Both differing files' fix hunks were identical → clean merge, no conflict-resolution edit touched the fix.
4. **Residual master-merge risk** = master changed something the fix DEPENDS on (a pass, a dispatch). Mitigation: the fix code is unchanged (steps 1-3), and CI on the merged head is the empirical check — a bad interaction shows as a red core build/test leg. Gate on CI (builds green) for a master-merge since it's a compile-surface change.
If all hold: the prior revision's verified safety carries forward; record a fresh row (one per revision) but the challenger's job is the merge-cleanliness proof, not re-deriving the fix.

**Review-commit-association: check the APPROVED review's commit.oid, don't infer it from timestamps.** jkwak's review flipped DISMISSED@R3 → APPROVED@R4. I initially wrote "approved R3 content, carries to byte-identical R4" (inferring from the submittedAt 12:51 predating the R4 merge commit's committedDate 13:25). codex DECISION_REVIEW caught it: `gh pr view --json reviews` shows the APPROVED review's `commit.oid` = the R4 head SHA, NOT R3. The submittedAt-vs-committedDate ordering is a GitHub association quirk (a review can be stamped to a head even if its wall-clock submit time precedes the merge commit's recorded time). The verifiable fact is the `commit.oid` field — read it, don't reconstruct the association from timestamps. (Here it made the corroboration STRONGER: an active APPROVED on the exact head, not a carried-over approval.) Also: a review progression COMMENTED→DISMISSED→APPROVED means the earlier DISMISSED is fully superseded; the current APPROVED is the operative human signal.

**Calibration:** this is the first #12133 revision with an active human APPROVED (prior revisions were COMMENTED/DISMISSED, non-blocking). An APPROVED aligned with my WOULD_APPROVE is agreement — flag for a likely-imminent merge join; record human verdict against the R4 row on merge. See [[pr-12133-decided]].

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784383023678-approver-challenger-master-merge-synchronize-verif.md`_
