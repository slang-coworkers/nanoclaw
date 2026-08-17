---
title: "[approver/clause-gap] website-content PR shows BOTH harvest-20 and commit_match-unevaluable — both are out-of-domain symptoms, still ABSTAIN_POLICY:OUT_OF_SCOPE not INFRA"
type: learning
topic: review-approval
source: learnings/1784618140917-approver-clause-gap-website-content-pr-shows-both-.md
---

# [approver/clause-gap] website-content PR shows BOTH harvest-20 and commit_match-unevaluable — both are out-of-domain symptoms, still ABSTAIN_POLICY:OUT_OF_SCOPE not INFRA

**Symptom:** On a shader-slang.github.io (website/docs) PR, two independent INFRA-looking signals co-occur and can double-mislead toward ABSTAIN_INFRA: (1) `collect-reviews.sh` exit 20 `{found:false}` — no bot review to harvest; and (2) if you run `eval-clauses.py` *before* synthesizing `review/review-doc.md`, `commit_match` comes back **unevaluable** (mechanically → ABSTAIN_INFRA:CLAUSE_UNEVALUABLE:commit_match). Observed on shader-slang.github.io#209 (NBickford-NV, "Publishes Intro to Slang lab course files", content-only: landing md +7/-0 + a .webp).

**Root cause:** Both are *structural out-of-domain symptoms* of the website repo, not a pipeline failure. Production `claude-pr-review.yml` runs on shader-slang/slang, not the Jekyll site → no bot review (harvest-20). And `commit_match` parses `commit_id` from the *synthesized* doc, not `harvest.json` — so it is unevaluable purely because the doc isn't written yet (see [[eval-clauses.py commit_match reads the SYNTHESIZED review-doc]]). Neither is a transport/pipeline failure on an in-scope PR.

**How to catch it:** The **repo-class predicate fires FIRST and overrides the mechanical review-signal → INFRA mapping** (see [[Non-compiler repo (website/blog/docs) is ABSTAIN_POLICY OUT_OF_SCOPE not INFRA]]). Verify the diff is content-only (no `_config`, CI, build-affecting code), then decide ABSTAIN_POLICY / `OUT_OF_SCOPE:website-content` regardless of how INFRA-shaped the clause/harvest output looks. Don't run Devin theater over prose.

**Fix:** After synthesizing the doc with `commit_id=<pinned head>`, re-run `eval-clauses.py` — `commit_match` flips to pass and you get a clean **6/6-clauses-pass** audit record whose abstain rests purely on the class predicate (matches precedent #208/#207/#204 framing: "6/6 clauses PASS but no repo-class predicate → class determination overrides"). Never round up to WOULD_APPROVE (no code-review signal), never ABSTAIN_INFRA (nothing failed). #207 was later vindicated by a genuine non-self human APPROVED+merge, so the withhold is calibration-safe.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784618140917-approver-clause-gap-website-content-pr-shows-both-.md`_
