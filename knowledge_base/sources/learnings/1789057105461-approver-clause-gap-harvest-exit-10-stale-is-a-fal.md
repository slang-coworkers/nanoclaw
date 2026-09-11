---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1789055931066-5rf26v
written_at: 2026-09-10T16:18:25.461Z
---

# [approver/clause-gap] harvest exit-10 "stale" is a false skip when the synchronize was a main-merge that didn't touch the reviewed files

**Symptom.** slangpy#1146 (docs-only): a fresh PR got an `opened` then a `synchronize` ~2 min later. On the new head, `collect-reviews.sh`/`harvest-reviews.py` returned **exit 10 (stale)** because CodeRabbit had submitted its review against the *previous* head. CodeRabbit's review carried **"Actionable comments posted: 3"** including a 🟠 Major functional-correctness finding. The workflow's default exit-10 handling ("IGNORE the stale review; fall to head-current Devin-only") — combined with Devin returning clean — would have produced a WOULD_APPROVE, i.e. a **false-safe** that discards a Major finding.

**Root cause.** "Stale" is defined by SHA inequality (`harvest.commit_id != pinned head`), but a `synchronize` is frequently a **merge of `main` into the branch** that touches *other* files (here: only `.github/workflows/ci-latest-slang.yml` and `ci.yml`) and leaves the PR's own reviewed files byte-identical. The reviewer's findings are then 100% applicable to the head — the staleness is a pure SHA-lag artifact, not a content change. Mechanically following "exit 10 → Devin-only" throws away the strongest signal on the PR (the slang#12064 `harvest_used=0` miss pattern).

**How to catch it.** On harvest **exit 10**, before falling to Devin-only, diff the *reviewed files* between the review's `commit_id` and the pinned head:
`for f in <changed docs/src paths>; do compare gh api contents/$f?ref=<review_commit>.sha vs ?ref=<head>.sha; done`
(or `gh api compare/<review_commit>...<head>` and check whether any reviewed file appears in `.files`). If the reviewed blobs are **identical**, the findings are LIVE.

**Fix.** When the reviewed blobs are identical at the head, treat the "stale" bot review as the fallback-tier source: synthesize the review doc from its findings, set the embedded `commit_id` = head (commit_match reads the review-doc's embedded `_approver_result.commit_id`, and its own docstring says a content-current review "passes off this field"), and document the SHA-lag-but-identical-blobs fact in the doc + challenger for auditability. Then judge the findings normally. Here all 3 CodeRabbit findings verified true against `slangpy/core/generator.py` → ABSTAIN_POLICY/OPEN_GAP, not a false WOULD_APPROVE. Core rule: *read the artifact (the diff between heads), not the framing (the exit code).*
