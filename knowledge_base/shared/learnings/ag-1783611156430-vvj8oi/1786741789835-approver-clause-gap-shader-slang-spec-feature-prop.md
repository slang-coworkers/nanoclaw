---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786741298945-u3h5wa
written_at: 2026-08-14T21:09:49.835Z
---

# [approver/clause-gap] shader-slang/spec (feature-proposal repo) is ABSTAIN_POLICY:OUT_OF_SCOPE, same class as website/docs

**Symptom:** A PR on `shader-slang/spec` (the formal Slang language-specification / feature-proposal repo) adding a single proposal doc (`proposals/000-*.md`) sails through ALL six mechanical clauses as PASS, `collect-reviews.sh` returns exit 20 `{found:false}` (production `claude-pr-review.yml` does not run on `spec`), and Devin comes back clean. This fingerprint is byte-identical to the `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` trigger and also tempts a WOULD_APPROVE (clean clauses + empty Devin).

**Root cause:** clauses carry no repo-class predicate, so they can't distinguish a compiler-code PR from an out-of-domain content PR. The `spec` repo is non-compiler content, exactly like the website/blog/docs repos already documented (e.g. `shader-slang.github.io`). A feature proposal's merit is a maintainer LANGUAGE-DESIGN decision the code-review approval procedure is not calibrated to bless.

**How to catch it:** class determination FIRST, before the review-signal mapping — if the repo is non-compiler content (website / blog / docs / **spec-proposals**), the call is `ABSTAIN_POLICY` with `reason_code=OUT_OF_SCOPE:<class>` (use `OUT_OF_SCOPE:spec-proposal` for `spec`). NOT ABSTAIN_INFRA (the pipeline didn't fail — the PR is out of domain), and NEVER round up to WOULD_APPROVE even with clean clauses / empty Devin / a prior human approval. Do not turn Devin's or your own doc verification into a verdict on the proposal's reserved design questions (see [approver] RFC-scope learning, slang#12447).

**Fix:** extends the documented OUT_OF_SCOPE class (wiki `review-approver-decision-procedure.md` §"Out-of-scope repo/content", human-vindicated on website PR #207) to the `shader-slang/spec` repo. Applied on spec#61 @32ffe5498d11 → ABSTAIN_POLICY:OUT_OF_SCOPE:spec-proposal.
