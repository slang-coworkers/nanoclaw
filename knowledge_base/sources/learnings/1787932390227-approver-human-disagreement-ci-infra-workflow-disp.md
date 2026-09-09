---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787927921445-yyyian
written_at: 2026-08-28T15:53:10.227Z
---

# [approver/human-disagreement] CI-infra workflow_dispatch privilege gap: maintainers merged my ABSTAIN unchanged — write-tier residual risk is treated as accepted

**Join outcome for shader-slang/slang PR #12812** (nightly-falcor-test.yml). My decision: ABSTAIN_POLICY / OPEN_GAP @d59c48dc0171. Human outcome: **APPROVED (jvepsalainen-nv, MEMBER, at head, after CodeRabbit's matching Moderate flag) and MERGED unchanged** (jkiviluoto-nv, mergedAt 2026-08-28T15:51:07Z, single commit, merged head == my decided head — zero interval commits, the flagged `workflow_dispatch` gap NOT addressed). So both the human review channel and the merge verdict = APPROVED-equivalent; my abstain was effectively overruled.

**Both rationales (recorded honestly, not scored as agreement):**
- *My abstain:* the new nightly declares `workflow_dispatch` + `schedule` and omits the `falcor-build-approval-gate`; verified that on `workflow_dispatch` the reusable build's `checkout` (no `ref:`) takes `github.sha` = dispatcher-selected branch, and the ci-approvers `environment:` gate isn't on the reusable job — so any write-access user could run arbitrary-branch code on the internal Falcor bridge, bypassing a gate their PR couldn't. Real, verified property.
- *Humans:* approved+merged as-is. The residual is gated behind **repo write access** (not fork/external), and NVIDIA maintainers evidently treat "a write-tier collaborator could run code on internal CI compute" as an accepted operational risk, not a merge blocker — especially for a backstop workflow whose value (nightly Falcor coverage of master) is immediate.

**Calibration lesson (transferable):** For CI-infra / workflow PRs, when the residual risk of an omitted gate reduces to **"a write-access user could do X"** (i.e. the fork/external/untrusted-author vector is already excluded), that is a **weak** OPEN_GAP for slang maintainers — they routinely accept it. Reserve OPEN_GAP-strength abstains for gaps reachable by *untrusted* actors (fork PR, `pull_request_target`, external contributor) or for correctness defects. A write-tier-only escalation on CI infra is better framed as an advisory nit that CLEARS (note it, don't abstain), unless it reaches secrets/prod-deploy or the diff itself is authored by an untrusted party. This does NOT retract the per-trigger discipline in the sibling [approver/challenger-miss] learning — enumerating every trigger and locating the gate correctly was right; what recalibrates is the *severity* assigned once the residual actor tier is "write-access only."

**Not a false-safe:** an ABSTAIN asserts nothing about code correctness; the code was fine and merged. The miss here is over-conservatism (abstained where maintainers would approve), which in shadow mode costs measurement signal, not safety.
