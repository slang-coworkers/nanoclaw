---
title: "[approver/clause-gap] nanoclaw-changelog-docs-PR-6of6-clauses-pass-still-OUT_OF_SCOPE-not-INFRA"
type: learning
topic: review-approval
source: learnings/1784745354331-approver-clause-gap-nanoclaw-changelog-docs-pr-6of.md
---

# [approver/clause-gap] nanoclaw-changelog-docs-PR-6of6-clauses-pass-still-OUT_OF_SCOPE-not-INFRA

**Symptom:** slang-coworkers/nanoclaw PR #1007 — a docs-only daily changelog refresh (`CHANGELOG-NV.md` +23/-5, appends a dated section + bumps per-branch merge counts), authored by `nv-slang-bot[bot]`, on the NanoClaw infra fork. The mechanical pipeline gave a clean run this time: `collect-reviews.sh` exit **20** (no bot review, none pending) and `eval-clauses.py` **6/6 PASS** (no gh-api 401 — unlike PR 982). A naive read of "6/6 pass + reviewers_complete via no-code-review" could drift toward WOULD_APPROVE or, on the harvest-20 `{found:false}`, toward ABSTAIN_INFRA:NO_REVIEW_SIGNAL.

**Root cause:** The eligibility clauses have **no repo-class predicate** — they are written for `shader-slang/slang` compiler PRs, so a non-compiler infra/docs PR sails through all six as PASS, and harvest-20 looks identical to the INFRA trigger. Neither is the decision basis.

**How to catch it:** Class determination fires FIRST and overrides the mechanical clause→INFRA / review-signal mapping. `slang-coworkers/nanoclaw` (and any `slang-coworkers/*` fork) is out of the compiler domain the clauses target → **ABSTAIN_POLICY, reason_code=OUT_OF_SCOPE:<class>** (here `nanoclaw-changelog-docs`). NOT ABSTAIN_INFRA (nothing failed — clauses all evaluable+pass, harvest-20 is an out-of-domain symptom, not a pipeline break). NOT WOULD_APPROVE (no applicable code-review signal — never round up). Skip Devin (prose theater on docs; doesn't inform class). Stamp `decision`/`reason_code`/`class` into `_approver_result` so the row can't drift to INFRA.

**Distinguish from PR 982:** #982 modified the approver's OWN harness → carried an *additional* conflict-of-interest ground. #1007 changed only `CHANGELOG-NV.md` (a docs artifact, not `container/skills/slang-pr-approver/**` or `container/workflows/slang-pr-approve/**`), so the primary — and sufficient — ground is **repo-class (non-compiler infra fork docs)**, no conflict-of-interest needed.

**Bot self-merge ≠ human verdict:** #1007 was MERGED by `nv-slang-bot[bot]` (== author) 20s after open, zero human reviews. Do NOT `record_human_verdict(APPROVED)` on a bot self-merge — it is neither agreement nor disagreement for calibration, and mapping it to APPROVED would falsely imply a human looked at an out-of-scope PR. Leave the row unjoined (or join only a genuine non-self human action). Same discipline as the website-content vindication rule: only a genuine non-self approval/merge counts.

**Fix:** Same as PR 982 / PR 208/209 family. Class family suffixes now in use: `website-content`, `course-materials-docs`, `approver-harness`, `nanoclaw-changelog-docs`.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784745354331-approver-clause-gap-nanoclaw-changelog-docs-pr-6of.md`_
