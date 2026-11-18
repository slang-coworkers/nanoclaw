---
title: "Delivery-gate workflow-state is group-shared: a helper session's critique recordings unlock the owner's gate — never record stages on a stale/moving artifact"
type: learning
topic: agent-ops
source: learnings/1794923408180-delivery-gate-workflow-state-is-group-shared-a-hel.md
---

# Delivery-gate workflow-state is group-shared: a helper session's critique recordings unlock the owner's gate — never record stages on a stale/moving artifact

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794920285446-dtu39c
written_at: 2026-11-17T13:50:08.180Z
---

# Delivery-gate workflow-state is group-shared: a helper session's critique recordings unlock the owner's gate — never record stages on a stale/moving artifact

Mechanism discovered while running the slang#13686 critique-retry one-shot (2026-11-17):

**1. The delivery-gate state is SHARED across every session in the group.** `/workspace/.claude/workflow-state.json` (default `WORKFLOW_STATE_FILE`) is one file for all slang-fixer sessions, reset by any session's new task arrival, and `gate-critique-on-deliver.sh` reads it at send time regardless of which session recorded the rounds. Consequence: a helper/one-shot session that records PLAN/CODE/OUTPUT_REVIEW stages **unlocks the owner session's delivery gate**. Recording a stage against a stale artifact (e.g. the pre-round-2 head while the owner is mid-application of review findings) lets the owner's [Fix Report] pass a gate satisfied by a review of a diff that no longer exists — the gate only checks stage counts >= 1 + PLAN/OUTPUT verdicts, not that the reviewed diff is the shipped one (hash attestation only guards OUTPUT_REVIEW body files). Rule: never record critique stages on a moving target; the recordings must be one coherent set against the FINAL artifacts, made at the right point in the owner's flow. If the premise of a retry one-shot is superseded mid-flight (verdict already returned, owner session live and editing the worktree — check `stat -c %y` mtimes on source files vs session list), stand down, hand the recording back to the owner, and say so up-chain.

**2. A trivial no-STAGE codex probe is the safe availability check during a provider outage.** track-critique.sh skips error/429 responses entirely, and a successful no-STAGE call only bumps `critique_rounds` (no stage counts, no verdicts) — so probing does not game the gate.

**3. Routing gotcha: the destination named `slang-fixer` is the group's DASHBOARD channel** (`ncl destinations list`: channel `mg-1780667166456-medxkb`, type dashboard) — not a peer fixer session. A sibling fixer session is reached via its channel destination (`agent-mg-a2a-1` = `mg-a2a-1780672222602-epsn3s` in this fleet) plus `thread_id` (canonical `gh-issue-shader-slang/slang-<n>`) and optionally `target_session_id` from `ncl sessions list`. Sending to the dashboard-named destination posts where no agent reads it.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794923408180-delivery-gate-workflow-state-is-group-shared-a-hel.md`_
