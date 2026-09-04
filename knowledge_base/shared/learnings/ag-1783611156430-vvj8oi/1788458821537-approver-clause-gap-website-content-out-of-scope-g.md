---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788458443416-23k6sb
written_at: 2026-09-03T18:07:01.537Z
---

# [approver/clause-gap] Website-content OUT_OF_SCOPE governs even when mechanical clauses are UNEVALUABLE (not just clean-pass)

## Symptom
Second website/blog PR decided OUT_OF_SCOPE: shader-slang/shader-slang.github.io#213 ("Add SIGGRAPH 2026 roundup post", one `_posts/*.md` Jekyll entry, +54/-0, author swoods-nv=MEMBER, same-repo branch). Decision: `ABSTAIN_POLICY` reason_code `OUT_OF_SCOPE:website-content` (policy v0-shadow, mode=live), matching the human-vindicated precedent #207.

The new wrinkle vs. #207: #207's recall note says all six mechanical Step-1 clauses came back PASS. On #213 `eval-clauses.py` returned two **UNEVALUABLE** clauses — `commit_match` ("review doc absent / no commit_id" — because no production bot review runs on the website repo) and `ci_green_on_sha` ("combined status=pending" — the Pages build). A naive mechanical mapping would then record `ABSTAIN_POLICY:CLAUSE_UNEVALUABLE:commit_match` (an *infra* reason_code that burns down the infra-abstain gate) — or, seeing the empty harvest, `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`. Both would be wrong.

## Root cause
The mechanical clauses and the challenger probes carry **no repo-class predicate** — they can't express "this repo is out of the compiler-approver's domain." On a non-compiler repo they therefore either pass vacuously or come back unevaluable for reasons that are *artifacts of the wrong-domain situation* (no bot review pipeline exists there; CI is a Pages build), not genuine pipeline defects.

## How to catch it
Repo name / changed-path class tells you up front: `*.github.io` + `_posts/*.md` (or docs/content) = website/blog. Make the **class determination FIRST**, before reading clause statuses or the harvest exit code.

## Fix
For website/blog/docs (non-compiler) PRs, record `ABSTAIN_POLICY` with reason_code `OUT_OF_SCOPE:website-content` regardless of whether the mechanical clauses come back PASS or UNEVALUABLE, and regardless of the empty harvest. OUT_OF_SCOPE (a policy/domain boundary) governs and is *excluded from agreement scoring*; it must NOT be downgraded to the infra family (`CLAUSE_UNEVALUABLE:<name>` / `NO_REVIEW_SIGNAL`), which would spuriously inflate the infra-abstain rate the quality gate drives to ~0. Never round up to approve even if a human later approves. Two instances now (#207 all-pass, #213 with-unevaluables) → the rule holds across both clause shapes.
