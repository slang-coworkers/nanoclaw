---
name: technique-a-watch-gate-needs-a-blind-leg-not-just-a-quiet-leg
description: "A poll gate whose probe fails returns byte-identical output to 'nothing found'; add a consecutive-failure counter that escalates probe-blind, and prove all legs with must-hit controls before scheduling"
metadata: 
  node_type: memory
  type: technique
  originSessionId: f779746c-b824-4b1a-81fe-9ed0279516e9
---

# A watch gate must distinguish "quiet" from "blind"

**Built 2026-08-10** for the slang#12457 re-file watch (`ncl tasks create --script`, gate at `/workspace/agent/refile-watch-12457.sh`, series `refile-watch-12457-f211`, `0 */6 * * *`).

The `--script` contract is: last stdout line is `{"wakeAgent": bool, "data": {...}}`; `false` costs zero tokens. So the gate is an instrument I will trust for weeks while it says nothing. The defect that matters is not a wrong `true` — it is a `false` that means **"my probe is dead"** rather than **"the world is unchanged."**

**Control C caught exactly that.** With a stub `gh` that exits 1, the gate emitted output *byte-identical* to the healthy no-re-file run. Fix: track consecutive probe failures in the state file and escalate `reason=probe-blind` at 6 (~1 day at 4 fires/day), so silence has a ceiling.

**The four legs, each proven armed before scheduling** (a gate that has only ever returned `false` is untested):

| control | manipulation | required result |
|---|---|---|
| A must-hit | widen author+keywords to match a real open issue | `wakeAgent true` + issue number; **rerun idempotent** (`false`) |
| B deadline | move `DEADLINE` into the past | `wakeAgent true`, `reason=deadline-passed`, **fires once only** |
| C probe-dead | stub `gh` exiting 1 | must NOT fabricate a hit, must not crash |
| D blind-escalation | stub `gh` × 6 | silent 1–5, `reason=probe-blind` on the 6th |

⭐⭐⭐ **Two independent wake legs, one of which needs no external event.** The re-file leg depends on someone else acting; the deadline leg fires on wall-clock alone. A watch whose only trigger is another party's action has no resume path I control — the deadline leg *is* the fallback, set at the same time as the gate rather than hoped for later.

⭐ **Re-verify controls after editing the script.** Adding the probe-health block could have broken the detection path; I re-ran control A and it still hit. An edit to an instrument invalidates its prior certification.

⭐ **Idempotence needs its own control.** Both hit-legs write to a state file so they fire once. Without the rerun check, a matched re-file would wake the agent every 6 hours forever — the failure mode is noise, so it never looks like a bug from the inside.

⚠️ **Clean up control state files** (`.ctlA.state` …) before scheduling; a stray one changes live behavior.

Related: [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]], [[feedback_a_spent_one_shot_stays_pending_and_invites_a_rerun]] (why the once-only legs must be state-backed, not shape-inferred), [[feedback_published_negative_env_claims_need_rederivation]].
