---
title: "[approver/clause-gap] approver-own-harness PR = ABSTAIN_POLICY:OUT_OF_SCOPE + conflict-of-interest, never self-approve"
type: learning
topic: review-approval
source: learnings/1784443235968-approver-clause-gap-approver-own-harness-pr-abstai.md
---

# [approver/clause-gap] approver-own-harness PR = ABSTAIN_POLICY:OUT_OF_SCOPE + conflict-of-interest, never self-approve

**Symptom.** A PR-approve dispatch landed for `slang-coworkers/nanoclaw#982` — a PR that (a) lives in the NanoClaw *infra fork*, not `shader-slang/slang`, and (b) modifies the slang-pr-approver's OWN decision harness (`SKILL.md`, `scripts/collect-reviews.sh`, `WORKFLOW.md`), including a change that *relaxes the DECISION/OUTPUT critique gate for ABSTAIN_* states*. The mechanical pipeline produced signals that look exactly like ABSTAIN_INFRA: `harvest-reviews.py` → exit 21 (FETCH FAILED), `eval-clauses.py` → all 6 clauses UNEVALUABLE. Root cause of those: the GitHub App token is scoped to shader-slang, so raw `gh api /repos/slang-coworkers/...` returns HTTP 401 (only the GraphQL-backed `gh pr view` / `gh pr checks` work against the fork).

**Root cause.** `eval-clauses.py` has NO repo-class predicate, and the 401 → all-unevaluable outcome is indistinguishable at the mechanical layer from a genuine pipeline defect. The correct call is a **class determination made FIRST, in the skill, before and overriding the clause→INFRA / review-signal mapping** (established rule: `[approver/clause-gap] non-compiler-repo` + concept page "Out-of-scope repo/content: class determination BEFORE the review-signal mapping"). Two independent out-of-scope grounds, either sufficient: wrong repo/domain, AND — new here — the PR changes the approver's own rules.

**How to catch it.** Before trusting harvest-21/all-clauses-unevaluable as INFRA, ask: *is this repo even in my policy domain (shader-slang/slang compiler code)?* If the dispatch names a non-shader-slang repo (a `slang-coworkers/*` infra fork, a website/docs/course repo) OR the changed paths are the approver's own harness (`container/skills/slang-pr-approver/**`, `container/workflows/slang-pr-approve/**`), it's OUT_OF_SCOPE. The token-401 is a *symptom* of out-of-domain, not the cause of the abstain. Extra: a PR to the approver's own decision procedure is a conflict of interest — self-endorsement (WOULD_APPROVE) is never permitted; a human must look.

**Fix.** Record `ABSTAIN_POLICY` with `reason_code=OUT_OF_SCOPE:<class>` (the enum is closed; the suffix is free-form — precedent: `website-content` PR 204/207/208, `course-materials-docs` PR 15; new suffix `approver-harness`). Stamp `decision`/`reason_code`/`class` explicitly into the synthesized `_approver_result` block so the record doesn't drift to the generic INFRA path. Skip Devin — a class determination is not informed by a review signal (no "Devin theater"). NOT INFRA (pipeline works, it's pointed at a repo it was never built for), NOT rounded up. CI-green (`gh pr checks`) is fine to note but doesn't change the class.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784443235968-approver-clause-gap-approver-own-harness-pr-abstai.md`_
