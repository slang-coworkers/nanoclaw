---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788381776635-wjqhq4
written_at: 2026-09-02T20:50:45.268Z
---

# [approver/confirmed] board-sync GITHUB_TOKEN write-grant PRs: protected-path ABSTAIN is correct; the grant is often forward-provisioning (inert until upstream reusable workflow consumes it)

## Symptom
slangpy#1132 "Grant PR board-sync callers GITHUB_TOKEN write" added `permissions: { issues: write, pull-requests: write }` to the 5 caller jobs that `uses: shader-slang/slang/.github/workflows/pr-board-sync.yml@master`. All 5 changed files were `.github/workflows/*.yml`. Decision: **ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths** — confirms the prior consolidated learning (`1785536628434-approver-confirmed-protected-path-only-board-sync`).

## Root cause / why the ABSTAIN is right (not a false-abstain)
`no_protected_paths` FAILs deterministically on any `.github/**` change and short-circuits at Step 1 before the challenger. The review input was fully clean (Devin 0 bugs/0 flags; CodeRabbit status green, nothing harvestable → Devin-only tier), yet a clean automated read must NOT upgrade this: maintainer eyes on workflow-permission YAML is exactly the policy's point. `CLAUSE_FAIL:no_protected_paths` is a POLICY reason (working-as-intended), not infra — it does not burn the infra-abstain gate.

## New transferable nuance — forward-provisioning / inert grant
Devin flagged that the granted `issues:/pull-requests: write` are **inert** at decision time: slang@master's reusable `pr-board-sync.yml` still declares `permissions: {}` and authenticates every call with the PAT (`SLANG_PR_BOT_TOKEN`), so the new `GITHUB_TOKEN` grants do nothing observable until the upstream consumer (shader-slang/slang#12888) lands. This is a *conditional/forward-provisioning* change whose enabling trigger is not yet present.

## How to catch it / probe for next time
When a caller-side permission or token grant precedes the upstream reusable-workflow change that would consume it: (1) the grant is dead until upstream lands — "looks safe because it does nothing yet" is expected, not reassuring; (2) the real behavior change happens on a *different* PR/repo (the upstream one), so the both-directions control (grant present → the guarded write actually happens as github-actions[bot]) can only be exercised after upstream merges. For the approver this is moot — protected-path ABSTAIN fires first regardless — but the framing sharpens the maintainer note and matches the "scope an unused-permission claim on reusable-workflow callers" challenger-miss discipline (`1785856892802`): code refs ≠ effective permission state across the caller→reusable boundary.

## Fix / rule
board-sync `.github/**` permission-grant PRs → ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths, every time. Don't upgrade on a clean Devin/CodeRabbit read. In the maintainer note, state whether the grant is inert-until-upstream (forward-provisioning) so the human knows the observable effect is gated on the upstream reusable-workflow PR.
