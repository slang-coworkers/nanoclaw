---
name: Verify regression/causal claims at claim-precision before relaying or escalating
description: A coworker's "master is red, commit X broke it" can be a PR-self-caused failure misattributed via an over-isolated experiment; verify suspect-commit changes at LINE precision and check merge_group (not just ci.yml) before routing a maintainer alarm
type: feedback
originSessionId: 6e136b74-35a7-4b97-b34f-57940381ca1d
---
Before relaying or escalating a coworker's regression/causal claim (especially "master is red" or "commit X broke it"), verify at the **precision of the claim**, not one level coarser:

- **File-touch ≠ line-touch.** If the claim is "commit X modified exactly where symbol/assert Y lives," check X's actual hunk line ranges (`gh api repos/O/R/commits/SHA --jq '.files[]|.patch'` → read the `@@` headers), not just that it touched the file. Incident 2026-06-19: slang-fixer claimed #11594 (`c872fadeb`) "modified 24 lines exactly where the texture assert at `hlsl.meta.slang:2515` lives"; I relayed "verified it touched hlsl.meta.slang at the assert site" — but #11594's hunks were at 463/5894/6442/7142, nowhere near 2515. #11594 was **innocent**.

- **"No ci.yml run since X" ≠ "commits unvalidated."** Master `ci.yml` can run sparsely; the merge-queue validates every landing commit via `merge_group` runs (same `test-slang` suite). Check merge_group runs, not just `ci.yml`, before concluding master is red. The exact master HEAD tree (`a84f48e62`) was GREEN in merge_group run 27711484629 (6340/6340) — proving master fine despite no recent `ci.yml` run.

- **A "controlled experiment" is only valid if the change is actually isolated.** slang-fixer rebased #11581 onto master, saw 2 unrelated tests fail, and concluded "master regression." But #11581's change (qualify extension-method name hints in `getNameForNameHint`) cross-cuts ALL extension-method name emission (CUDA/HLSL identifiers + diagnostic notes), so it broke 2 pre-existing tests that hard-coded the old unqualified names (`loadVecOnce_0`→`DiffTensorView_loadVecOnce_0`; `Sample`→`_Texture.Sample`). The change was NOT isolated → the experiment misattributed self-caused failures to master.

**Why:** a false "master is red / commit X broke it" escalation is high-cost — it can falsely accuse an innocent PR/author to maintainers and spread misinformation. The verify-before-posting guardrail in my babysitter dispatch ("verify at HEAD before any GitHub post") caught my flawed premise downstream — the babysitter overturned it and posted nothing.

**How to apply:** route regression claims to slang-ci-babysitter for authoritative classification (it checks merge_group + bisects), and always instruct "verify at HEAD before any GitHub post." Don't relay the premise as verified until the load-bearing facts (suspect-commit hunk LINES, master-green-via-merge_group) are checked at claim precision.
