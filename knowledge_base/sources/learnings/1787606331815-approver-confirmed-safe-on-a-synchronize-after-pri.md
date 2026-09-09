---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787334321515-r8nnjm
written_at: 2026-08-24T21:18:51.815Z
---

# [approver/confirmed-safe] On a synchronize after prior approval: decide on the PR's own diff, not the compare interval; re-check CI now-green and DISMISSED-not-retracted

**PR:** shader-slang/slang #12643 revision @ 35925a877fde (prior WOULD_APPROVE @ 15a5ad5a). A `synchronize` fired after a `Merge branch 'master'` + a re-authored fix commit. Fresh per-commit WOULD_APPROVE.

**Transferable checks for a synchronize-after-approval (all bit me / codex caught this round):**

1. **Decide on the PR's OWN diff, never the head-to-head `compare` interval.** The `gh api compare/OLD...NEW` interval was 16 commits / 40 files — but ~all of it was unrelated master-merge churn (empty-struct emit, CUDA vector ops, wasm bindings, CI workflow files…). The PR's true diff (`gh pr diff --name-only`, three-dot vs base) was 4 files. Isolate what the PR AUTHOR changed since your prior decision by comparing the PR's own files across the two heads (sha256 the blobs), not by reading the compare file list. Here: hlsl.meta.slang guards UNCHANGED, test file BYTE-IDENTICAL (sha256), only 2 docs changed. Message wording must not say "the 40 files are churn, excluded" — the three-dot compare *includes* the PR files too; say "the PR-authored delta is X; the compare is dominated by unrelated master-merge churn while the PR diff remains N files."

2. **A DISMISSED prior approval is `live_late`, not `live`.** The skill defines `live_late` = ANY human review exists on the PR, dismissed or not. Don't downgrade to `live` just because the approval was dismissed. (Ledger tag only; doesn't change the verdict — but the critique gate will must-fix it.)

3. **DISMISSED ≠ RETRACTED — prove stale-on-push from the timeline.** The `review_dismissed` event has TWO commit fields: top-level `commit_id` (was null here) AND nested `dismissed_review.dismissal_commit_id` (was 5d3123bec891). A jq that reads only the top-level field wrongly concludes "no dismissal commit." Read the NESTED field, and corroborate with a same-timestamp `head_ref_force_pushed` event to the same commit — that pair is hard evidence the dismissal was branch-protection stale-on-push, not a human changing their mind.

4. **A synchronize can turn a caveat into resolved evidence — re-check CI.** At the prior head CI tests were still in_progress (I carried a caveat). At the new settled head CI was fully green (51 checks, 49 success/2 skipped/0 failing, fetched==total_count; main CI workflow success on the exact head_sha) — so the diagnostic test PASSED in CI, upgrading the evidence. Always re-pull CI at the new head; don't inherit the prior head's CI status.

5. **Carried advisory nits persist across revisions** — the "tex*Lod only float/uint/int" imprecision (char/short families also supported; only __half is what the guard rejects) reappeared and even spread into the new docs/target-compatibility.md. Re-surface it; don't assume a prior revision's nit was addressed.
