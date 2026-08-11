---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786362729574-aa7chs
written_at: 2026-08-10T12:21:39.042Z
---

# [approver/infra-abstain] slangpy has no primary review producer — Devin timeout there is an instant NO_REVIEW_SIGNAL, not a fallback

**Symptom.** slangpy#1096 @84c9ab9ca1d5: `collect-reviews.sh` returned exit 20 ("no harvestable bot review, none pending") and `devin-fetch.sh` exited 3 (timeout, ~20 min, no `devin-flags.md`). Result: `reviewers_complete=false` → `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`, despite a clean, well-evidenced challenger investigation.

**Root cause — two independent facts that compound.**
1. **slangpy has no `claude-pr-review.yml`.** Its `.github/workflows/` contains `claude.yml` (the @-mention responder) only. So the primary-tier `github-actions[bot]` review the approver harvests on `slang` **has no producer on slangpy**. Exit 20 there is *structural*, not a timing race — waiting/re-harvesting will never help.
2. **CodeRabbit on slangpy may post a walkthrough issue-comment with no review object.** Its commit status reached `success` (11:53:49Z, after the 11:51:47Z head push) and its walkthrough comment updated at 11:53:55Z — but `harvest-reviews.py`/`collect-reviews.sh` only select *review objects*, so a walkthrough-only run is invisible to the harvest and yields exit 20 with `pending_bot=null`.

Consequence: on slangpy, **Devin is frequently the ONLY possible verdict source**, so a Devin timeout is not a degraded-but-usable fallback — it is total signal loss. The same timeout on `slang` would still leave the primary Claude review.

**How to catch it.** When harvest returns 20 on slangpy, don't read it as "production genuinely skips this PR" (the documented exit-20 meaning, which assumes a producer exists). Check whether a producer exists at all: `gh api repos/<owner>/<repo>/contents/.github/workflows --jq '[.[].name]'` and look for a review workflow. If none, you are Devin-only *by construction* — budget accordingly and treat a Devin failure as immediately terminal.

**Trap to avoid.** CodeRabbit's walkthrough had **no** `Actionable comments posted: N` line. Do **not** read that missing line as "CodeRabbit found nothing" — an unpopulated field is not substantive silence. It carries zero bits about code quality; the walkthrough is a description, not a findings verdict.

**Fix.** (a) Consider raising `devin-fetch.sh --max-minutes` on slangpy specifically, since there is no primary-tier fallback behind it. (b) Consider teaching the harvest to record a CodeRabbit walkthrough-only run distinctly (e.g. a new exit code / `walkthrough_only` field) so "CodeRabbit ran but published no findings verdict" is distinguishable from "no bot engaged at all" — today both collapse to exit 20.

**Do not** let a clean self-investigation substitute for the missing doc. Mine was unusually strong here (verified both-directions CI control; a green 12-job Linux wheels run at a commit carrying the identical reduced package list) and it still must not become the verdict — investigation can add caution, never manufacture review signal.
