---
title: "A maintainer merging master into your PR branch can silently fix the root cause — rebuild+retest after any base move"
type: learning
topic: ci-tooling
source: learnings/1781651810617-a-maintainer-merging-master-into-your-pr-branch-ca.md
---

# A maintainer merging master into your PR branch can silently fix the root cause — rebuild+retest after any base move

**Context:** slang PR #11499 (2026-06-16). I was a partial crash→diagnostic fix for #11496. A push got rejected ("fetch first") because maintainer jkwak-work had merged `master` into my `fix/issue-*` branch server-side. After `git rebase FETCH_HEAD` (my single commit applied cleanly), the rebuild's regression test FAILED — because the merged-in master had **resolved the root-cause crash upstream**: the repro now compiled to valid SPIR-V, so my diagnostic-asserting test saw the now-absent error.

**Lessons (reusable):**
1. **After ANY base move (rebase onto a moved branch, maintainer's merge, `git pull`), rebuild + re-run the targeted test.** A "clean rebase" only means the diff applied — it does NOT mean the surrounding world is unchanged. Master may have changed APIs your code depends on, or fixed the very bug you're fixing.
2. **A diagnostic/repro test that suddenly fails after a base move may be an EXPECTED false-FAIL, not a regression** — the bug got fixed elsewhere. Verify empirically: run `slangc` on the repro directly (+ `SLANG_RUN_SPIRV_VALIDATION=1`). If it now compiles to valid output, the crash is gone. Per the slang test-authoring convention, repurpose such a test from a `DIAGNOSTIC_TEST` into a **positive** `SIMPLE` compile test (e.g. `//TEST:SIMPLE(filecheck=CHECK):-target spirv-asm …` with `//CHECK: OpTypeImage`) so the crash can't silently return. Don't silently accept the FAIL, and don't claim your PR "fixes" something master already fixed — escalate the changed premise to your coordinator.
3. **Don't assume YOUR follow-up PR was the upstream fix.** Verify it actually merged (`git log <merge-base>..HEAD | grep <PR#>`). In my case #11502 (my own follow-up) had NOT merged; an unrelated master commit fixed it. Hedge accordingly in any maintainer-facing comment ("appears resolved by an upstream commit; haven't bisected").

**Bonus (slang bot env, 2026-06-16):** `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` now returns `HTTP 403: Must have admin rights to Repository` — the `nv-slang-bot` App install lacks `actions:write`. CI still auto-runs on the `pull_request` trigger when you push, so manual dispatch is both impossible AND unnecessary. Don't retry the dispatch; rely on the auto-trigger.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781651810617-a-maintainer-merging-master-into-your-pr-branch-ca.md`_
