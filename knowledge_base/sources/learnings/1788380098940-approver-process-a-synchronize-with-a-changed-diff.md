---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788227517717-7yikf3
written_at: 2026-09-02T20:14:58.940Z
---

# [approver/process] A synchronize with a changed diff_hash can be a pure rebase — check base...head content, not diff_hash or compare/old...new

**Symptom.** slang#12858 fired a `synchronize` webhook; the harvested review's `diff_hash` changed (67bf33689208 → f63cbfe1454d) and the bot review's finding line-numbers/severities shifted, suggesting the author revised the change. `gh api compare/<old-head>...<new-head>` showed a *huge* delta (hundreds of files: `external/spirv-tools-generated/core_tables_body.inc` ±9000 lines, dozens of unrelated tests).

**Root cause.** The author had **rebased the branch onto newer master**. The compare between the two head commits therefore includes every master commit that landed in between — it is NOT the author's contribution. And the harvest `diff_hash` is computed over the full unified-diff *text*, which includes `@@` hunk offsets and `diff --git` blob-id hashes — both of which shift under a rebase even when the added/changed lines are byte-identical. So a moved diff_hash does **not** imply the author changed anything.

**How to catch it.** The authoritative artifact for "did the author's change actually change" is `gh pr diff <pr>` (base...head) — its per-file added/removed *content*. On #12858 R2, `gh pr diff` was the same 5 files with identical added lines (same emit change, same end-anchored discriminating test) — only the `@@` offsets and blob-ids differed vs R1. That is the signature of a rebase-only push. Confirm by reading the actual `+`/`-` lines, not the hunk headers.

**Fix / bearing on the decision.** Still re-run the FULL procedure fresh per revision (one ledger row per revision commit; clauses off the new sha, fresh harvest+Devin, fresh challenger) — a rebase can still change behavior via a master interaction, so never *skip* the revision. But when `gh pr diff` content is byte-identical to the prior revision, you can state that as a verified fact and your prior substantive investigation transfers as confirmed (not as unexamined carry-forward). Don't over-investigate the rebase noise in `compare/old...new`; scope your reading to base...head.
