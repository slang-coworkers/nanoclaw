---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786620263869-46cklr
written_at: 2026-08-13T16:13:34.095Z
---

# [approver/infra-abstain] harvest exit 10 (stale) can hide a CLEAN head-current CodeRabbit re-review living in the summary comment, not the review object

**Context:** slang-rhi#839 R2 @ 4096abb94d74. After a force-push/rework, `harvest-reviews.py` returned **exit 10 (stale)** — its chosen CodeRabbit *formal review object* still targeted the OLD pre-push range (`e11c29cf…c03f9cf11bd8`, "2 actionable comments"). I initially concluded "Devin-only tier, both external reviewers reviewed the superseded diff, my own read is the sole head signal." That was WRONG.

**Root cause:** CodeRabbit posts an incremental re-review of a force-pushed head as an updated **summary comment** (the `<!-- recent_review_start -->` / `recent_review` block), NOT always as a new formal *review* object. `harvest-reviews.py` keys on the review object → sees only the stale one → exit 10. But `collect-reviews.sh` is a superset: it ALSO captures the summary comment into `review/coderabbit-review.md`. In this case that file's `recent_review` block read: "Reviewing files that changed ... between c03f9cf…4096abb" (the exact head interval, the 2 reworked files) → **"No actionable comments were generated in the recent review 🎉"**, mergeability "🔵 Low · up to `4096a`", 5/5 pre-merge checks passed. i.e. a CLEAN head-current CodeRabbit signal was present the whole time.

**How I caught it:** only because the DECISION_REVIEW critique gate (codex) read `coderabbit-review.md` directly and flagged "your DEVIN-ONLY/stale basis contradicts the collected head-current CodeRabbit run at lines 68/89/133." I then opened the file and confirmed. Neither `harvest.json` nor `collect.json` (which just records `exit:10`) surfaced it — you must READ the recent_review block.

**Rule (add to Step 1b staleness handling):** On harvest exit 10/20 for a slang-rhi PR, before declaring the CodeRabbit signal stale/absent and falling to Devin-only, GREP `review/coderabbit-review.md` for a `recent_review` / `<!-- recent_review_start -->` block and check its "between X and Y" footer against the pinned head. If it covers the pinned head, that IS your head-current CodeRabbit signal (clean = "No actionable comments generated"; or actionable count > 0). Distinguish this from slang-rhi#836, where the head was genuinely un-reviewed (a green *status* with no matching recent_review body). The discriminator: does a recent_review footer name the pinned head? If yes → head-current signal exists; if no → truly stale/Devin-only.

**Impact:** would have mislabeled the tier as Devin-only and understated confidence (the decision — WOULD_APPROVE — was unchanged, since my own head-current read agreed, and the change was purely additive opt-in infra; but the audit trail was factually wrong until corrected). A future case where my own read disagreed with a missed clean CodeRabbit signal could flip a decision.
