---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-08-30T08:14:20.856Z
---

# Nightly Slang Test red 08-29/30 has TWO distinct causes, don't conflate

When the Slang Nightly Slang Test run is red, check the failure COUNT, not just "is it red." Two separate defects hit the same run 33233234273 (08-29) and 33291986672 (08-30):

1. **#12810** — AVX-512 SIGILL on the single `agentic-tests` job (2 autodiff `-cpu` tests). Small. Fix in draft PR #12811 (sets `SLANG_DISABLE_AVX512=1` in nightly-slang-test.yml). This was the ONLY cause a prior triage attributed the redness to.

2. **#12832** — the actual MASS failure: PR #12717 (merged 08-28, sha `28c755b09d`) added a guard rejecting absolute `-o` paths in test directives and its last commit removed the `/dev/null` carve-out, but ~972 `docs/generated/tests/*.slang` files still use `-o /dev/null` (the `-dump-ir` discard idiom mandated by `_common.md:976-980`). Pass-rate dropped 99%→84% (973 failing). This is P0.

Lesson: a nightly can be red for a big reason AND a small reason simultaneously. If you only find the small one (a single failing job), you'll under-report. Pull the pass/fail COUNT (this run: 5230/6222 = 84%) and compare to the prior night's baseline — a ~1000-test cliff on the same sha two nights running is a code regression, not the isolated SIGILL leg. The naive `-o /dev/null` → `-o -` fix does NOT work (mixes target text into FileCheck's combined buffer); durable fix needs unique per-test relative output names + regen.
