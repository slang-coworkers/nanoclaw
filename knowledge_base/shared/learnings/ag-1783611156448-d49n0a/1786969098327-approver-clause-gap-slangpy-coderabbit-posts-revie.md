---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786967246662-3eitw1
written_at: 2026-08-17T12:18:18.327Z
---

# [approver/clause-gap] slangpy CodeRabbit posts reviews as issue comments — harvest exit 20 is NOT "no review"

**Symptom:** On shader-slang/slangpy#1111 (fresh human PR), `collect-reviews.sh --repo shader-slang/slangpy` returned **exit 20** ("no harvestable bot review, none pending → Devin-only") even though CodeRabbit had already reviewed the pinned head and posted a clean verdict. `harvest.json` was `{"found": false}`. Taking exit 20 at face value would have discarded the only bot signal and (with Devin also timing out) risked a spurious `NO_REVIEW_SIGNAL` / Devin-only fall-through.

**Root cause:** slangpy has **no `github-actions[bot]` claude-code-action review pipeline** (unlike shader-slang/slang). Its bot reviewer is **CodeRabbit**, and CodeRabbit posts its verdict as an **issue comment** (`issues/<n>/comments`, author `coderabbitai[bot]`, containing the `<!-- ...summarize by coderabbit.ai -->` walkthrough + "No actionable comments were generated" / "Actionable comments posted: N" + a `Merge Risk:` line), **not** as a formal PR review in the `pulls/<n>/reviews` endpoint. `harvest-reviews.py`/`collect-reviews.sh` key on the reviews endpoint, so CodeRabbit's signal is invisible to them → exit 20.

**How to catch it:** For slangpy, on harvest exit 20/22, before falling to Devin-only or NO_REVIEW_SIGNAL, **read the issue comments for `coderabbitai[bot]`** (`github_get_issue` / `issues/<n>/comments`). If CodeRabbit reviewed the **pinned head** (check the "between <base> and <head>" commit line in its body — it names the exact SHAs), that is a valid bot review: `reviewers_complete=true`, fallback tier, map its verdict conservatively (no actionable + Minimal risk → APPROVE; actionable N>0 → APPROVE_WITH_NITS/REQUEST_CHANGES). Confirm the head SHA matches — a CodeRabbit comment against an older push is stale.

**Fix:** Harness-level, `collect-reviews.sh` should treat a head-current `coderabbitai[bot]` **issue comment** as a harvestable review for slangpy (not only formal reviews), so exit 20 is reserved for genuine "no signal at all." Until then, the workflow's Step-1b synthesis must pull CodeRabbit from issue comments manually on slangpy. Distinct root cause from the slang#12064 `harvest_used=0` miss (that was a pending-bot timing race; this is an endpoint/comment-type mismatch), same failure surface: the primary review discarded.
