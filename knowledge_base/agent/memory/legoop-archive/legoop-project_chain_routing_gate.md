---
type: project
title: "chain-routing check (ALWAYS-ON, not an overlay) enforces in_reply_to on marked handoffs; June 2026"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# chain-routing check (ALWAYS-ON, not an overlay) enforces in_reply_to on marked handoffs; June 2026

**FINAL DESIGN (after PRs #558-561):** the chain-routing check is **always-on, NOT an overlay**. `checkRoutingGate` (poll-loop.ts text-output dispatch) + `gate-chain-routing.sh` (PreToolUse) are keyed ONLY on the chain delivery marker — no marker file, nothing to select. It enforces a structural invariant (`[MUST]` in chain-reporting.md) and is self-scoping (only chain coworkers emit `[Fix Report]`/`[Triage Resolution]`/etc.). The `chain-routing-gate` overlay dir was DELETED. **KEY PRINCIPLE: overlays are operator-selected per agent-group from dashboard > coworkers (`agent_groups.overlays` → `opts.overlays`), NEVER type-declared in coworker-types.yaml.** The `resolve.ts` type-chain loop that briefly allowed type-declaration was reverted. critique-gate stays a real dashboard-selected overlay (forcing /codex-critique is a heavy policy, legitimately optional).

---
(Original landing #554-557, since corrected by #558-561 above:)
The `chain-routing-gate` overlay was the deterministic replacement for Buddy's most-repeated concern (marked handoffs missing routing fields). It blocks `[Fix Report]/[Resolution]/[Triage Resolution]/[Review Verdict]/[handoff]` sends that lack routing, on two paths: `gate-chain-routing.sh` (PreToolUse, direct send_message) and `checkRoutingGate` in `container/agent-runner/src/poll-loop.ts` (text-output `<message>` dispatch).

**Correctness contract (fixed 2026-06-03):** pass iff **`in_reply_to` is present**; `thread_id` is OPTIONAL because the runtime derives it (`applyInReplyToDefaults` in mcp-tools/core.ts). The original impl wrongly required BOTH and false-rejected the spec's canonical upstream report `send_message(to="parent", in_reply_to=<id>)`. `thread_id`-alone still blocks — `in_reply_to` is the routing primitive (resolves inbound row → source_session_id → edge). Both gates carry a **3-denial soft-cap** (`routing_gate_denials` / `critique_gate_denials` in workflow-state.json, created if absent) mirroring `gate-critique-on-deliver.sh`; backfilled the same cap into `checkCritiqueGate` which previously refused forever (the orchestrator-with-no-codex deadlock that caused 15 dead refusals on the nanoclaw session).

**Branch split** (feature spans 4 owners; only nv-main has working CI per [[project_ci_yml_propagation]]):
- #554 → nv-main: gate logic, hook, overlay, tests, buddy CHARTER, path-guard allowlist entry (`container/overlays/chain-routing-gate/**` added to .github/nv-path-guard/nv-main.txt next to critique-gate/plan-gate)
- #555 → nv-slang, #556 → nv-slangpy, #557 → nv-nanoclaw: `overlays: [chain-routing-gate]` on triage/fixer/reviewer + `in_reply_to` added to bare upstream reports in slang-fix-issue/slang-pr-review/nanoclaw-pr-review workflows

Sibling branches reference the nv-main-owned overlay — resolves at fan-merge (same cross-branch pattern as base-nanoclaw, [[project_nv_branch_cross_imports]]). Path-guard CI on nv-main rejects new files outside nv-main.txt allowlist — add new generic overlays there. See [[feedback_precommit_hook_drops_files]] for the commit footgun hit during this work.

