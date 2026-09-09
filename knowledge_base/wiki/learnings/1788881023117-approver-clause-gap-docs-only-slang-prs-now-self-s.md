---
title: "[approver/clause-gap] docs-only slang PRs now self-satisfy the SlangPy Tests status via a merged skip-job — ci_green_on_sha 'green' no longer implies a real SlangPy run"
type: learning
topic: slang-compiler
source: learnings/1788881023117-approver-clause-gap-docs-only-slang-prs-now-self-s.md
---

# [approver/clause-gap] docs-only slang PRs now self-satisfy the SlangPy Tests status via a merged skip-job — ci_green_on_sha "green" no longer implies a real SlangPy run

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788870662615-uvoowg
written_at: 2026-09-08T15:23:43.117Z
---

# [approver/clause-gap] docs-only slang PRs now self-satisfy the SlangPy Tests status via a merged skip-job — ci_green_on_sha "green" no longer implies a real SlangPy run

## Symptom / signal
shader-slang/slang#12939 ("Post skipped SlangPy status for docs-only PRs", fork head jkiviluoto-nv/slang, single file `.github/workflows/ci-slangpy-trigger-test.yml`) was decided **ABSTAIN_POLICY** (CLAUSE_FAIL:head_provenance + co-fail no_protected_paths). It then **merged unchanged** at my exact decision commit `9e449e6f007d` — human MEMBER jvepsalainen-nv APPROVED, Devin clean, no follow-up commits. Abstain rows are excluded from agreement scoring, so this is neither a false-safe nor a disagreement; the policy simply routed a fork-authored CI-workflow change to a human, who approved it. Expected shadow-mode behavior.

## Root cause (the transferable part — now LIVE in master)
The merged change adds a `mark-slangpy-tests-skipped` job: when the docs-only filter emits `should-run=false`, it posts `SlangPy Tests` = **success** ("Skipped for docs-only change.") on the PR head via `createCommitStatus`. `SlangPy Tests` is exactly the cross-repo **combined commit status** context that the approver's own `ci_green_on_sha` clause trusts (see wiki concept `slang-a-approver-clause-gaps.md`, D2 section). So as of this merge, on **docs-only** slang PRs a green `SlangPy Tests` no longer means "SlangPy actually ran" — it can mean "a workflow job auto-posted success because tests were intentionally skipped." This is the concrete, now-shipped instance of the D2 self-referential hazard my Step-0 recall flagged.

## How to catch it / what it sharpens
On future slang PR reviews: when `ci_green_on_sha`=success on a **docs-only** PR, do NOT read that as evidence the SlangPy suite passed — it may be the skip-job's synthetic success. The check is legitimately terminal (fixes the real stuck-`pending` merge-queue eviction from #12389/#12309), so it's correct for docs-only, but the challenger should not treat that particular green as substantive test coverage. Only matters if a future PR is misclassified docs-only by the filter (`.github/actions/docs-only-filter`) — a source-changing PR that slips through would get a synthetic SlangPy success. Worth a glance at the filter's classification if a PR both touches source AND shows a skip-posted SlangPy status.

## Confirmation
The fork-head + `.github/**` protected-path abstain shape remains a pure policy-routing artifact for trusted-MEMBER authors (this PR reconfirms the standing pattern; author was MEMBER, change was benign). No new escalation — the empty-mount fork-head abstain is already a standing operator escalation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788881023117-approver-clause-gap-docs-only-slang-prs-now-self-s.md`_
