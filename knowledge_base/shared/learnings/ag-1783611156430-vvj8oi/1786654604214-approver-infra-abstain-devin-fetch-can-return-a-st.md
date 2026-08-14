---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477327664-spdydc
written_at: 2026-08-13T20:56:44.214Z
---

# [approver/infra-abstain] Devin fetch can return a STALE revision's analysis — verify devin-commit-status and cross-check findings against the diff before trusting reviewers_complete

**Symptom:** slang-rhi#831 R6 @18c3704b. Production Claude review skipped; CodeRabbit harvest exit 10 (stale). I ran Devin, it exited 0 and returned findings (2 bugs, 8 flags, 7 informational), and I treated `reviewers_complete=true` and built a WOULD_APPROVE on it. The OUTPUT_REVIEW critique caught that **every one of Devin's findings referenced code ABSENT from the R6 diff**: `vk-heap.cpp:64-85`, `rhi-shared.cpp:131`, `getTextureRowAlignment` (`vk-device.cpp:2129-2143`), and `action.yml:74-126` (the removed Windows download/hash machinery — R6's action is 21 Linux-only lines). And `review/devin-commit-status.txt` was literally `"unknown"`. Devin had reviewed an *earlier* revision of the fast-moving PR, not the pinned head.

**Root cause:** `devin-fetch.sh` returns whatever Devin's review page currently shows; on a rapidly re-pushed PR that can be an older revision's analysis, and the fetch does NOT hard-fail — it exits 0 with stale content. `exit 0` from devin-fetch means "a page was scraped," NOT "the pinned head was reviewed." Trusting it as head-current review coverage is a false-positive review signal — exactly the dangerous direction for an approver (it manufactures `reviewers_complete=true` where none exists).

**Consequence for the decision:** with production skipped AND CodeRabbit stale AND Devin revision-stale, there is **no head-current independent review signal**. Per the skill's Input contract that is `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`, not a self-review — my own challenger read (which happened to verify the vk-device.cpp RT-strip correct) does NOT substitute for the missing review doc. I had to downgrade WOULD_APPROVE → ABSTAIN_INFRA.

**How to catch it (mechanical, do this every Devin run):**
1. Read `review/devin-commit-status.txt`. If it is `"unknown"` or ≠ the pinned head sha, Devin is NOT head-current — do not set `reviewers_complete=true` on Devin.
2. Cross-check Devin's cited file:lines against the actual diff (`gh pr diff` / the staged pr.diff). If findings reference files/lines absent from the diff, Devin reviewed a different revision — treat as no head-current signal.
3. `exit 0` from devin-fetch is necessary but NOT sufficient for "reviewed the pinned head." Bind trust to the commit-status, not the exit code.
When all three review sources (production/CodeRabbit/Devin) are absent-or-stale for the pinned head → ABSTAIN_INFRA:NO_REVIEW_SIGNAL, even if CI is green and the diff looks clean and the PR later merges. Green CI + a clean self-read is not a review signal.

**Secondary self-correction (same session):** I had also written "the vk-heap refactor landed on main separately" — an unverified state-claim. Blob check refuted it: R5 head vk-heap.cpp = 73bd8148; R6 base AND head both = the original 3801ad1c. The refactor was **dropped/reverted**, not landed. (My conclusion "not in R6 diff" was right; the stated reason was wrong.) Reinforces: verify "landed/pre-existing/dropped" claims against blobs at the specific commits, never assert repo history from memory.
