---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788969289206-7526qe
written_at: 2026-09-09T16:04:48.394Z
---

# [approver/confirmed] Faithful bash→github-script CI-step port is loud-failure-direction; workflow-file PRs policy-abstain

## Symptom
slangpy#1145 "Make the cherry-pick step run on Windows as well as Linux" replaced a `shell: bash` `run:` block with `actions/github-script@v8` in `.github/workflows/ci-latest-slang.yml`. Surface-resembles "a conditional CI change," which can tempt an OPEN_GAP abstain for lack of a positive control.

## Root cause / classification
Not a new gate. The step's `if:` (`github.event.client_payload.slangpy_cherry_pick_pr`) was UNCHANGED — this is a language port of an existing step, motivated by self-hosted Windows runners having no `bash` on PATH. Classify by FAILURE DIRECTION: the port is faithful (trim → `.trim()`; digit check → `/^[0-9]+$/`; `set -e` → `exec.exec` rejects on non-zero; empty → no-op). If the port were wrong it fails LOUDLY when triggered (step errors), not silently-wrong. No silent-behavior-change path found. So the "inject-the-hazard positive control" probe is N/A — demanding it would false-abstain (matches prior learning: narrowing/port ≠ new-flag+new-gate).

## Decision
Moot for the ledger anyway: under `v0-shadow-wide-r2` the policy lists `.github/workflows/**` as a protected path, so ANY workflow-file PR resolves at Step 1 to ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths (early return, no challenger/critique). This is the policy working as intended — route workflow edits to a human. Human outcome: merged (APPROVED-equivalent), consistent with the abstain.

## How to catch it / transferable signal
- Two non-obvious facts worth checking before flagging a CI-matrix "gap": (1) this workflow has NO `pull_request` trigger (only schedule/workflow_dispatch/repository_dispatch), so the cherry-pick step is NEVER exercised by the PR's own CI — "never-triggered", not "pending"; (2) CodeRabbit's "add macOS matrix" Major finding is a misread — the `build-pr` matrix is Windows+Linux by explicit design ("Debug and macOS covered by nightly"); macOS IS covered by the nightly `build` job. Outside-diff + pre-existing + by-design ⇒ not a diff-introduced gap.
- Rule: for a faithful bash→github-script port of an existing CI step, verify (a) the `if:` gate is unchanged, (b) `set -e` semantics preserved (`exec.exec` rejects on non-zero), (c) validation regex/trim equivalence — then failure direction is loud, and the change clears the challenger. Under the current policy it abstains on the protected-path clause regardless.
