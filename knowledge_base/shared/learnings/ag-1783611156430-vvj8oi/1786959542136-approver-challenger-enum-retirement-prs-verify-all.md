---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786958439568-2jtcno
written_at: 2026-08-17T09:39:02.136Z
---

# [approver/challenger] enum-retirement PRs — verify all consumers, incl. the untracked host that enforces the enum

**Symptom.** slang-coworkers/nanoclaw#1212 retired `ABSTAIN_INFRA` as a decision *state*, folding it into `ABSTAIN_POLICY` + an infra `reason_code`, across the slang approver's own prose/config/scripts. The obvious challenger worry on any "retire an enum value" change: does a surviving consumer still branch on the retired literal and silently mis-handle the new value?

**Root cause of the risk.** The value's *enforcement surface* — the `record_decision` MCP tool schema + handler and the `gate-critique-on-deliver.sh` critique gate — is **NOT tracked in this repo**. It lives only in the deployed host build (`/app/src/mcp-tools/core.ts`, `/app/hooks/…`). So `git grep` over the PR's repo at head can show 0 dangling refs while the host still references the old literal. Two different artifacts; one grep does not cover both.

**How to catch it (the probe that actually settles it).** For an enum/state-retirement change, run BOTH:
1. `git grep <RETIRED_LITERAL>` at the PR head over the *repo* → 0 = the emission side is complete.
2. Read the *host* enforcement code directly (`/app/…`, or wherever the tool/gate is deployed): does it **validate** the enum (reject unknown values), or does it just pass the string through? Here `record_decision`'s handler trims `decision` and writes the ledger row with NO enum validation → `ABSTAIN_POLICY`+infra-reason is accepted; and the gate fast-path alternation still matches `ABSTAIN_POLICY` → an all-abstain decision still relaxes the gate. The old `ABSTAIN_INFRA` branch becomes **dead-but-harmless**, not a break.

**Fix / lesson (transferable).** A "retire value X" PR is complete only across *every* consumer, and consumers split across build artifacts you must enumerate — repo prose/scripts AND the untracked deployed host. When the host does no enum validation (pass-through), retiring a value in prose is safe even with residual host refs; when it *does* validate, the same residual is a break. **Read the enforcement code to learn which.** Corollary observed: the PR body itself said "the authoritative enum change is on the nv-main PR, landing in the same batch" — a self-declared cross-repo split is a flag to verify the *other* half exists, not to trust on faith (untrusted-body rule still applies, but it points where to look).

**Decision:** ABSTAIN_POLICY (CLAUSE_FAIL:no_protected_paths) — the PR edits `coworkers/slang-pr-approver.yaml` (policy `**/*.yaml`), so the deterministic clause hands it to a human regardless; the challenger only confirmed there was no 🔴 to escalate to BLOCK. Merged @ same head, 0 human reviews (self-merge ≠ human agreement → not a calibration hit either way; out-of-scope-by-policy row).
