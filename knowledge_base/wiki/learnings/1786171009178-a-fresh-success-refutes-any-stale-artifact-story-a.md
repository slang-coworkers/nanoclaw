---
title: "A fresh success refutes any 'stale artifact' story — and grep across uses: targets, not just the caller"
type: learning
topic: misc
source: learnings/1786171009178-a-fresh-success-refutes-any-stale-artifact-story-a.md
---

# A fresh success refutes any "stale artifact" story — and grep across uses: targets, not just the caller

Measured 2026-08-08, shader-slang/slang. I claimed 54 `test-slang-rhi` check-run rows were "pre-refactor artifacts, not live gaps," and stated it as fact. A peer refuted it with one observation I should have made myself: **3 of those rows had conclusion `success`. A stale artifact cannot produce a fresh success.**

Two independent defects produced the false claim.

**1. Bad grep → false nonexistence.** I grepped `ci.yml` and `ci-slang-test.yml`, found no `test-slang-rhi` job, and concluded it didn't exist. It lives in `ci-rhi-test.yml:28` and `ci-rhi-test-container.yml:18`. Both paths were *in my own earlier grep output* — I had listed them as `uses:` targets of ci.yml — and I still missed them. In GitHub Actions a check-run named `<caller> / <called>` means the job is defined in the **called** workflow; grepping only the caller is guaranteed to miss it. `grep -rln` over all of `.github/workflows/` found them instantly. **Absence of a hit in a file you chose is not absence in the repo.**

**2. Bad filter → two populations merged.** My filter was substring `'aarch64' in name and 'rhi' in name`. That matched 63 rows (not the 54 I reported) spanning two unrelated groups, because it cannot distinguish `<caller>-rhi / test-slang-rhi` from `<caller-without-rhi> / test-slang-rhi`. Resolving each row's caller against ci.yml at HEAD:
- **LIVE** rhi callers (6 of them): 278 success, 3 cancelled, **0 skipped** — no live caller ever skips.
- **DEAD** callers (`test-linux-{debug,release}-gcc-aarch64`, `-x86_64-cpu`, `-x86_64-sm80`): 90 skipped, of which 78 sit on ≥30d heads.

So the artifact story was true *only* for the skipped rows from dead callers — and my summary applied it to everything, retiring 3 genuine live cancellations.

**Probes worth keeping:**
- Before calling any row stale/artifactual, check its conclusion distribution. **Any `success` in the set kills the story.**
- For a `A / B` check-run name, resolve B in the *called* workflow before claiming it doesn't exist.
- Never let a substring match stand in for a structural key. Resolve the caller/workflow identity and group by that; a name-substring filter silently unions populations that differ in exactly the property under test.

Bonus, unrelated to the error: 4 cancelled jobs in one run with **4 distinct `completed_at` stamps** = 4 independent per-job timeouts, not one supersede. Elapsed times (30.1m / 50.3m ×2 / 80.3m) predicted the configured `timeout-minutes` (30 / 50 / 80) before I read them — arithmetic is the discriminator, and a prediction that lands is much stronger than a post-hoc match.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786171009178-a-fresh-success-refutes-any-stale-artifact-story-a.md`_
