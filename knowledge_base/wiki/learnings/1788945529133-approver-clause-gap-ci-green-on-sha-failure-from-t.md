---
title: "[approver/clause-gap] ci_green_on_sha=failure from the external 'SlangPy Tests' repository_dispatch status, not a check-run — expected-red on SlangPy-coordination PRs"
type: learning
topic: slang-compiler
source: learnings/1788945529133-approver-clause-gap-ci-green-on-sha-failure-from-t.md
---

# [approver/clause-gap] ci_green_on_sha=failure from the external "SlangPy Tests" repository_dispatch status, not a check-run — expected-red on SlangPy-coordination PRs

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788911836136-096yqh
written_at: 2026-09-09T09:18:49.133Z
---

# [approver/clause-gap] ci_green_on_sha=failure from the external "SlangPy Tests" repository_dispatch status, not a check-run — expected-red on SlangPy-coordination PRs

**Symptom.** On shader-slang/slang#12975 R2 (@665f0b47b1a8), `eval-clauses.py` flagged `ci_green_on_sha = fail` ("combined status=failure"), whereas R1 (@b733dc73b943, ~9h earlier) was `unevaluable` ("pending"). The PR diff (a `.github/workflows/ci-slangpy-trigger-test.yml` change) did not regress any build.

**Root cause / mechanism.** `ci_green_on_sha` reads the legacy **combined commit status**, which merges *both* GitHub check-runs *and* external commit **statuses**. On slang the red came entirely from an external `repository_dispatch` status named **"SlangPy Tests"** (state=`failure`); every actual build/test **check-run** on the head had `conclusion` ∈ {success, skipped} and none was running (`gh api commits/<sha>/check-runs` → 0 non-completed, 0 failing). The "SlangPy Tests" status is posted by shader-slang/slangpy's `ci-latest-slang.yml` after slang fires a `repository_dispatch` — there is no check-run backing it.

**Why the red is expected-in-context here.** #12975 exists *because* upstream #12840 retyped matrix layout `int`→`MatrixLayoutMode` (a breaking change), which breaks SlangPy `main` against slang `master` — so "SlangPy Tests" is red on *every* slang PR until the coordinated SlangPy fix merges. #12975's whole purpose is to set `SLANGPY_CHERRY_PICK_PR` so SlangPy CI merges that fix during the run. So the red is the *pre-existing coordinated condition the PR addresses*, not a regression introduced by the diff.

**How to catch it (reporting/challenger discipline).** When `ci_green_on_sha=fail`, before treating it as a diff regression, split the combined status: `gh api repos/<repo>/commits/<sha>/statuses` (external statuses: "SlangPy Tests", "CodeRabbit", "license/cla") vs `gh api repos/<repo>/commits/<sha>/check-runs` (real build/test). If the sole red is an external `repository_dispatch` status (esp. "SlangPy Tests") and all check-runs passed/skipped, say so — it is a cross-repo coordination state, and for a PR that *targets* that check it is expected, not a code defect. This is the inverse of the known combined-status false-*green* defect (one trivial green poster masking red check-runs): here an external status makes combined-status *red* while check-runs are all green.

**Bearing on the decision.** On #12975 it was moot (head_provenance + no_protected_paths already force ABSTAIN_POLICY, early return). But on a **clause-passing** SlangPy-coordination / submodule-bump PR, `require_ci_green:true` + this external red would drive a genuine ABSTAIN — arguably correct (don't auto-approve while the coordinated check is red), but the reason should be reported as "external coordinated check red," not "the diff broke CI."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788945529133-approver-clause-gap-ci-green-on-sha-failure-from-t.md`_
