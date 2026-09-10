---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788981843970-odwx3f
written_at: 2026-09-09T19:50:36.175Z
---

# [approver/infra-abstain] collect-reviews.sh exit 20 misses head-current CodeRabbit summary-comment review (slang#12064-class)

**Symptom.** On shader-slang/slang#12968 @67bfa5a49bf9, `collect-reviews.sh --commit <head>` returned **exit 20** (`harvest.json = {"found": false}` → "no bot review AND none pending → Devin-only"). But a **head-current CodeRabbit review DID exist**, embedded in CodeRabbit's *summary issue comment*: the comment's `createdAt` was ~20h stale, yet CodeRabbit had EDITED it in place on the `synchronize` and it explicitly covered the pinned head — `coveredCommitId:"67bfa..."`, `change_assessment_commit:"67bfa..."`, "Reviewing files that changed ... between <base> and <head>", "No actionable comments were generated", "Merge Risk: ⚪ Minimal". Trusting exit 20 blindly would have discarded a valid primary-secondary signal.

**Root cause.** The harvester keys "found" on formal PR *reviews* (the `/reviews` array — empty here) and/or a commit-tied review object. CodeRabbit's head-current verdict lives in an **issue comment** (`/issues/<n>/comments`), and its `createdAt` is the original creation time, NOT the last edit — so a staleness check on `createdAt` looks old even though the body was re-generated for the new head. The harvester never inspected the comment body's embedded `coveredCommitId`/`change_assessment_commit` markers.

**Why it matters.** Not decision-changing here (I recovered manually and Devin also ran clean). But on a PR where Devin ALSO fails/times-out, this same miss yields a spurious `ABSTAIN_POLICY` reason `NO_REVIEW_SIGNAL` — the exact slang#12064 `harvest_used=0` failure class the infra gate exists to burn down.

**How to catch it.** When harvest returns 10/20/22 ("no/stale/pending bot review"), do a cheap independent cross-check before falling to Devin-only: `gh pr view <pr> --json comments --jq '.comments[]|select(.author.login=="coderabbitai")|.body'` and grep the body for `coveredCommitId"|change_assessment_commit"|final_review_risk_coverage`. If any equals the pinned head SHA, CodeRabbit reviewed the head — incorporate it (reviewers_complete=true) instead of treating it as absent. Judge CodeRabbit staleness by the body's embedded covered-commit markers, never by the comment's `createdAt`.

**Fix (script).** `collect-reviews.sh`/`harvest-reviews.py` should parse CodeRabbit's summary-comment body for the `coveredCommitId`/`change_assessment_commit` HTML-comment markers and treat a head-matching value as a harvested secondary review (exit 0/secondary tier), rather than requiring a formal `/reviews` entry or keying staleness on `createdAt`.
