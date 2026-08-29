---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787927921445-yyyian
written_at: 2026-08-28T14:57:30.935Z
---

# [approver/challenger-miss] CI workflow that omits an approval gate: check EVERY declared trigger, not just the one the PR justifies

**Context:** shader-slang/slang PR #12812 added `.github/workflows/nightly-falcor-test.yml` — a nightly Falcor CI run that deliberately omits `ci.yml`'s `falcor-build-approval-gate` (ci-approvers `environment: falcor-ci`). Decision: ABSTAIN_POLICY / OPEN_GAP.

**Symptom:** A workflow PR whose comment rigorously justifies dropping a security/approval gate for ONE trigger (`schedule`) while silently declaring a SECOND trigger (`workflow_dispatch`) that reintroduces exactly the risk the gate defends. The PR comment even asserted "this workflow only ever checks out origin/master" — literally false for the `workflow_dispatch` trigger it itself declares.

**Root cause / the trap:** For a `schedule` event, `github.sha` is always the default-branch (master) tip and GitHub resolves the workflow file from the default branch — genuinely safe. For a `workflow_dispatch` event, `github.sha` is the **dispatcher-selected ref's head** (any branch/tag), and the reusable build workflow's `actions/checkout` had **no `ref:`** → it checks out that arbitrary `github.sha`. The internal-compute approval gate (`environment: falcor-ci`, required reviewers = ci-approvers) lived ONLY on a separate gate job in `ci.yml`, NOT on the reusable test workflow — so a workflow that calls the reusable jobs directly reaches the gated internal resource with NO gate. Net: any repo write-access user can dispatch arbitrary-branch code onto the internal Falcor bridge, bypassing a gate their equivalent PR could not.

**How to catch it (transferable rule):** When a CI/workflow PR omits or bypasses an approval/security gate, enumerate EVERY trigger in `on:` and answer the trust question per-trigger — the PR will typically justify only the safe one.
- `schedule` / `push`-to-default → resolves from + checks out default branch → usually safe.
- `workflow_dispatch` → dispatcher chooses the ref → `github.sha` = arbitrary branch; requires write access (not fork/external), so the residual surface is "write-tier user escalates to a ci-approver-gated internal resource." That is still a real escalation because environment gates have NO actor exemption (even a MEMBER's PR is gated).
- `pull_request_target` / `workflow_run` → the classic privileged-context traps.
Then check WHERE the gate actually lives: an `environment:` gate on a job in `ci.yml` does NOT protect a *different* workflow that calls the same reusable `workflow_call` jobs directly. Read the reusable workflow's own `environment:`/`if:` — if the gate isn't on the reusable job, a new caller isn't gated.

**Positive-control caveat:** "sibling nightlies also have `workflow_dispatch`" does NOT clear it — verify the siblings reach the SAME gated resource. Here the siblings (`nightly-slang-test.yml`, `nightly-remix-test.yml`) run on GitHub-hosted runners and never touch the gated Falcor bridge, so the risky combination (dispatch + gated internal resource) was novel to this PR.

**Note:** CodeRabbit independently flagged this (Merge Risk Moderate); Devin (clean) and the PR comment both reasoned only about `schedule`. The human MEMBER reviewer approved at head after the flag — so this may join as a human-approved-vs-my-abstain; an ABSTAIN asserts nothing about the code, just "a human must look," and one did. Still worth the per-trigger discipline.
