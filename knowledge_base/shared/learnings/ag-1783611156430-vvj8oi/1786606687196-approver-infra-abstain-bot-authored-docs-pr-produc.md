---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786604041243-q41y2e
written_at: 2026-08-13T07:38:07.196Z
---

# [approver/infra-abstain] Bot-authored docs PR: production review skips + Devin 30m timeout = NO_REVIEW_SIGNAL

**Symptom.** shader-slang/slang PR #12511 (@b66c4ee45af8, "docs/generated: stop generated test READMEs from breaking the Pages build") resolved to ABSTAIN_INFRA:NO_REVIEW_SIGNAL. All 6 Step-1 clauses passed (v0-shadow-wide); CI (`check-doc-gaps`) green; a human had already APPROVED — yet the approver had zero *review* signal to decide from.

**Root cause (two artifacts, both named).**
1. `review/harvest.json` = `{found:false}`, `collect-reviews.sh` exit 20. The PR is authored by `nv-slang-bot[bot]`, and production's claude-code-action PR-review genuinely SKIPS bot branches (fixer/bot/Claude branches). No `coderabbitai[bot]` review existed either. So the Devin-only tier is the correct path — production skip is NOT an abstain by itself.
2. `review/devin-error.txt` = "timeout: Devin did not reach a stable done state within 30m" (devin-fetch.sh exit 3, `--max-minutes 30` default). Devin is the Devin-only tier's SOLE signal; when it fails, `reviewers_complete=false`.

No bot review harvested AND Devin failed => Step 2 harness-integrity short-circuit => ABSTAIN_INFRA:NO_REVIEW_SIGNAL. Correct per SKILL Input contract + Step 2.

**How to catch it / the discipline that matters here.** The tempting error is to let a thorough own-read of the diff + green CI stand in for the missing review verdict and round up to WOULD_APPROVE. The invariant forbids it: the approver never self-reviews in place of the missing doc, and CI-green is a *clause input*, not a Step-2 verdict prior. With no Step-2 prior there is nothing to carry into the challenger — the abstain is mandatory, even on a change that reads clean (this one added a `lint_liquid_safe` guard to `regenerate.py` with positive+negative self-tests that CI's hard-gate `lint`+`selftest` actually execute over all 80 bundle READMEs — strong *engineering* evidence, zero *review-signal* bits).

**Fix (to burn down the infra gate).** For bot-authored PRs, Devin is the single point of failure and it timed out at 30m. Options to raise the signal rate: (a) bump `devin-fetch.sh --max-minutes` for the Devin-only tier so a slow-but-live Devin session still lands; (b) detect Devin "still generating at scrape time" vs a true stall and extend only the former. Until then, bot-authored PR + Devin timeout is a legitimate, non-optimizable-away NO_REVIEW_SIGNAL — the human approve on the PR is the backstop (shadow mode never auto-approves anyway).
