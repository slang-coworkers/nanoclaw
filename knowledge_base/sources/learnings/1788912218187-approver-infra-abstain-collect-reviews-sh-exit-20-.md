---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788911836136-096yqh
written_at: 2026-09-09T00:03:38.187Z
---

# [approver/infra-abstain] collect-reviews.sh exit 20 drops a clean CodeRabbit summary-comment review (no review object)

**Symptom.** On shader-slang/slang#12975 (@b733dc73b943), CodeRabbit ran `@coderabbitai review` and completed cleanly on the *exact* pinned head — "No actionable comments were generated in the recent review 🎉", Priority Low, Merge Risk Minimal, CodeRabbit commit-status `success`, coverage `kind:"reviewed"` for the head. Yet `collect-reviews.sh --commit <head>` returned **exit 20** with `harvest.json = {"found": false}`, i.e. "no bot review, none pending → Devin-only". A real, clean secondary review signal existed but the harvest reported none.

**Root cause.** `collect-reviews.sh` builds its candidate set `cand` only from formal PR **review objects** (`GET /repos/…/pulls/<pr>/reviews`, filtered to `github-actions[bot]`/`coderabbitai[bot]` with non-empty body). It separately captures CodeRabbit's **summary issue-comment** into `cr_summary` (matched on `"summarize by coderabbit"` / `"Actionable comments posted"`). But the no-candidates branch fires first and ignores it:

```
# collect-reviews.sh ~line 172
if not cand:
    pend = pending_bot()
    ... json.dump({"found": False, ...})
    finish(22 if pend else 20)     # never consults cr_summary
```

`cr_summary` is only ever used *past* this block (building `coderabbit-review.md` when ≥1 review object already exists). So when CodeRabbit reports "no actionable comments" it typically posts **only the summary issue-comment and no review object**, and if production Claude also posted no review object, `cand` is empty → exit 20, and the captured clean CodeRabbit verdict is discarded.

**Why it matters / when it bites.** On #12975 it was harmless (Step-1 clauses fork-head + protected-path failed → ABSTAIN_POLICY short-circuits before the verdict is read). But on a **clause-passing** PR whose only review signal is a clean CodeRabbit summary comment, this yields a spurious Devin-only fall — and if Devin also fails, a spurious `ABSTAIN_POLICY:NO_REVIEW_SIGNAL` (an infra-gate burn) on a PR that actually had a clean secondary review. This is the concrete mechanism behind the prior "a SlangPy/submodule PR can reach the approver with ZERO usable review signal" note.

**How to catch it.** When harvest returns exit 20/`found:false`, before trusting Devin-only on a clause-passing PR, cross-check CodeRabbit directly: `gh api repos/<repo>/issues/<pr>/comments --jq '.[]|select(.user.login=="coderabbitai[bot]").body'` for a `recent_review` block ("No actionable comments" / "Actionable comments posted: N"), and `gh api repos/<repo>/commits/<sha>/statuses` for `context:"CodeRabbit" state:"success"` with a `final_review_risk_coverage` matching the pinned head. If present, that IS a harvestable clean secondary review → synthesize the fallback-tier doc from it rather than treating it as no-signal.

**Fix (script).** In the `if not cand:` branch, fall back to `cr_summary` before declaring exit 20: if a CodeRabbit summary comment exists whose `final_review_risk_coverage.coveredCommitId` (or `change_assessment_commit`) equals the pinned head, emit `found:true` with `login=coderabbitai[bot]`, `commit_id=<head>`, `diff_hash=commit:<head>`, body=`cr_summary`, exit 0 (fallback tier). Only return 20 when neither a review object nor a head-matching CodeRabbit summary comment exists.
