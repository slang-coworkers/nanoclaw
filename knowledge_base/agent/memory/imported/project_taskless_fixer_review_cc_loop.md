---
name: Taskless-fixer empty-ack loop from reviewer combined-review CC
description: slang-reviewer CCs combined-review.md to slang-fixer on every review; if the fixer has no active task it wakes and loops bare "holding silently" acks — distinct from the self-wiring incident (no self-edge)
type: project
originSessionId: 17bd1e20-8f30-4f2e-a1cf-d5ef3cb72b8b
---
A distinct loop mechanism from the self-wiring incident (`project_self_wiring_loop_incident.md`). Observed 2026-06-26 on slang-fixer (group `ag-1780667166439-vmjrwe`).

**What happens:** slang-reviewer's review workflow fans out `combined-review.md` via `send_file` to BOTH parent and `slang-fixer` by default. When the reviewed PR is human-authored (no active fixer task), the CC mints a fresh a2a edge to the fixer and wakes a **taskless** fixer session. The fixer then emits bare "Holding silently / No reply" text which — per "bare text is delivered, not scratchpad" — routes to the reviewer via the fixer's legitimate `slang-reviewer` peer destination, in a tight loop (one msg every few seconds). It burns fixer compute and repeatedly wakes the reviewer.

**Why:** No self a2a edge is involved (verified via `ncl destinations list` — slang-fixer has `parent`/`slang-triager`/`slang-reviewer` agent edges + dashboard/a2a channels, NO self→self agent edge). The loop is the taskless-wake + bare-text-delivery combo, not a self-wiring mint.

**Diagnosis recipe:**
- `ncl destinations list | awk '$1=="<fixer-group-id>"'` → confirm no self→self agent edge; note a freshly-created `agent-mg-a2a-*` channel row whose timestamp matches the reviewer's file-send (that's the trigger edge).
- Central-DB `last_active` LAGS badly — do NOT rely on it to pin the looping session; trust the reviewer's observation of inbound cadence instead.

**Fix (worked):** `ncl groups restart --id <fixer-group-id>` (routes to operator approval; killed 3 containers 2026-06-26, loop broken, no respawn without `--message`). Blast radius = whatever else the fixer was running (then: parked #11538, safe — branch/worktree state survives on disk).

**How to apply:** When a coworker reports a peer flooding it with near-identical empty acks, check for a self-edge first; if none, look for a recent reviewer file-CC that woke a taskless downstream. Restart the looping coworker's container. If it resumes post-restart, the next step is clearing the stuck pending inbound on the trigger a2a edge.
