---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786376190630-6p704z
written_at: 2026-08-10T15:41:48.565Z
---

# [approver/clause-gap] Vendored third-party code blows the size cap and buys no review signal

**Symptom.** slangpy#1050 ("Add BC texture compression, decompression, and DDS support", head `0340b204dab9`) hit `tier_eligible` FAIL at 12652 lines / 26 files against the `v0-shadow-wide` cap of 8000 → `ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible`. But 7644 of those 12652 lines (60%) are **vendored upstream sources** dropped in wholesale: `external/bc7enc/{rgbcx.cpp,bc7enc.cpp,rgbcx_table4.h,rgbcx.h,bc7enc.h}` = 6155 and `external/include/bcdec.h` = 1489. The **authored** surface is ~5000 lines (`src/sgl/core/bc_codec.cpp` 1001, `dds_file.cpp` 356, `bc_types.h` 227, plus ~1615 of tests), which is comfortably under the cap.

**Root cause.** `eval-clauses.py`'s `tier_eligible` sums `additions+deletions` over every file in `compare/base...sha` with no notion of authorship. The cap exists as a proxy for *how much human-written code a reviewer must hold in their head*, but the predicate measures *bytes moved*. Any PR importing a third-party library trips it regardless of how small the reviewable delta is. Note CodeRabbit already encodes the right distinction: its `.coderabbit.yaml` has `!external/**`, so it explicitly listed those same 7 files as "ignored due to path filters" and reviewed only the authored 19.

**Why it matters beyond one abstain.** The cap is the single most abstain-productive clause in shadow mode (the policy's own comment: `tier_eligible` fired on PRs of 3200-6718 lines against the then-2000 cap, and 91% of abstains that later got a decisive human verdict were approved). A vendoring PR is the *worst* case for it: the churn is large and simultaneously the least review-relevant, so the clause spends its whole budget on lines no reviewer reads.

**How to catch it.** When `tier_eligible` fails, split the churn by path before reporting the abstain as if the PR were genuinely huge: `gh api repos/<repo>/compare/<base>...<sha> --jq '.files[] | "\(.additions+.deletions)\t\(.filename)"' | sort -rn`. If vendor/generated prefixes (`external/**`, `third_party/**`, `vendor/**`, lockfiles, generated tables) dominate, say so in the abstain — "12652 total, ~5000 authored" tells the human something very different from "12652 lines".

**Fix.** At re-tightening time (the policy file already flags the cap as needing empirical calibration), `tier_eligible` should measure churn **excluding a vendor-path exclude-list**, mirroring the repo's own review config (`.coderabbit.yaml`'s `!external/**`) rather than inventing a second list — with the vendored import itself becoming a distinct signal (a supply-chain surface worth its own clause), not silently free. Until then this stays a correct abstain under the letter of the policy; the learning is that the *reason* reported should name the vendored split, or the human reads it as a 12.6k-line change.
