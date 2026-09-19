---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-18T12:25:57.508Z
---

# CI babysitter: tracked-regressions self-heal leaves a base-skew gap unless forward-guarded

**Bug class**: `tracked-regressions.json` entries self-heal `open`→`closed` when their GitHub issue closes (correct — stops excluding NEW PRs). But PRs whose head still predates the fix commit get ZERO protection after the self-heal: the exclusion is gone, and `base-skew-signatures.json` (the "PR predates a required upstream commit" registry) has no automatic carry-forward. Discovered 2026-09-18 when #13041 (windows-aarch64 verify-doc script fix, PR #13042) self-healed on 2026-09-17, and PR #13086 (6 commits behind the fix) got misclassified as a fresh regression on 2026-09-18 — a classify-only subagent even recommended rerunning it; only caught by manually running `gh api compare/<fixCommit>...<prHead>` and seeing `status:diverged, behind_by:6`.

**Fix, permanent**: `sweep-script-v2.mjs`'s `loadAndRefreshExclusions` now takes `baseSkewEntries` as a param and stamps every closed tracked-regressions entry with `needsBaseSkewGuard = !baseSkewEntries.some(b => b.context === entry.job)`, surfaced as `exclusions.needsBaseSkewGuardCount` in every wake payload (backfilled retroactively, not just for future closes). Non-zero count = a self-heal happened with no forward-guard added yet — visible immediately instead of rediscovered via a misclassified PR.

**Second gap fixed at the same time**: base-skew matching was name+ancestry only, no log-content check — fine for a single-purpose status (`SlangPy Tests`) but wrong for a broad job name like `test-slang / build`, where ANY failure on a pre-fix PR would auto-classify `needs-rebase` even if the real cause was an unrelated regression in that PR's own diff. Added optional `logGrep` (same literal-substring, AND-semantics, copy-pasted-not-paraphrased rule as tracked-regressions.json) verified via the existing `verifyExclusionSignature` helper before finalizing `needs-rebase`. Required threading job `id` through `splitExclusions`→`classifyBaseSkew` (was passing bare name strings before).

**Rule going forward**: whenever a tracked-regressions.json entry self-heals to closed, immediately add/verify a matching base-skew-signatures.json entry keyed to the fix commit, with the logGrep carried over verbatim (already vetted text). Don't wait for a recurrence — the ≥3 bar is for filing new GitHub issues, not for internal classification-registry upkeep, and this is squarely CI-babysitter charter (no operator approval needed, verified live against #13086's real data 2026-09-18).
