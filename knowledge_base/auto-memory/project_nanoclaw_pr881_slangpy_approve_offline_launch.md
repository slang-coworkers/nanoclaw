---
name: project_nanoclaw_pr881_slangpy_approve_offline_launch
description: "slang-coworkers/nanoclaw#881 bot docs fix — slangpy-pr-approve offline batch launches each PR as its own self-thread session; nanoclaw-fork PR, handled inline NOT routed, maintainer owns merge"
metadata:
  node_type: memory
  type: project
  originSessionId: pr881-slangpy-approve-offline
---

**slang-coworkers/nanoclaw#881** — `docs(slangpy-pr-approve): offline batch launches each PR as its own self-thread session`, branch `fix/haaggarwal/slangpy-approve-offline-launch` → `nv-slangpy`. **Bot-authored** (nv-slang-bot), maintainer-namespaced (haaggarwal = szihs). `pr_ready_for_review` webhook fired 2026-07-10. Docs-only: +10/−2, single file `container/workflows/slangpy-pr-approve/WORKFLOW.md`.

**Handled inline by Main — NOT routed.** Same repo-class as [[project_nanoclaw_pr874_webhook_route_approver]] / #864–879: NanoClaw platform-infra fork, not in the product-coworker routing map, no `nanoclaw-pr-approver`/`nanoclaw-reviewer` wired. The webhook task string ("Route it to the project's *-pr-approver coworker") is the generic PRODUCT-PR instruction (the very string #874 fixed) — it does NOT mean route a *nanoclaw-repo* PR to `slangpy-pr-approver` (that coworker approves shader-slang/slangpy PRODUCT PRs, not nanoclaw infra PRs). Do NOT route.

**Inline review verdict: clean, self-consistent, correct.** Fix documents that the offline/historical batch step must launch each PR as its own isolated session via `send_message(to:"self", thread_id:"gh-pr-<repo>-<pr>", …)` — distinct `thread_id` per PR mints a separate per-thread session (one session = one PR's revision chain). Matches NanoClaw's session key `(agent_group, messaging_group, thread_id)`. Correctly flags the dependency: the `self` agent-destination row must exist (companion config change) else the destination gate rejects the send and it silently no-ops; instructs verification via `ncl sessions list`. Worker `[Approval Decision]` routes back to launcher (ancestor) — consistent with direct-edges parent model. Root cause it fixes: approver guessed "separate sessions" via a shared/no-thread self-send that collapsed into the current session.

**CI:** `label`✓; `ci` IN_PROGRESS at review time (docs-only → expected green); `mergeStateStatus: UNSTABLE` only because ci still running; `mergeable: MERGEABLE`, not draft, 0 reviews.

**Merge is the maintainer's** (haaggarwal-owned branch → `nv-slangpy`, tracks upstream slangpy). NOT auto-merged: auto-merge grant ([[feedback_nv_coworkers_automerge]]) is `nv-coworkers`-scoped, not `nv-slangpy`. No GitHub comment posted — clean, green, self-evident maintainer docs fix (comment hygiene). On redelivery: state unchanged; do NOT route to product approvers, do NOT re-review, do NOT auto-merge.
