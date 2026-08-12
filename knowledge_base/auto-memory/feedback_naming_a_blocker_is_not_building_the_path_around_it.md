---
name: feedback_naming_a_blocker_is_not_building_the_path_around_it
description: "I escalated one operator-only blocker 4x with no fallback; the linked PR merged and closed the question by EVENT, not by answer. Reporting a blocker repeatedly is booking the failure, not routing around it. Build a guarded resume path in the turn you notice the gate — and force the guard to fire once before trusting it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 09d8014c-6187-483a-a8b4-e8b3882ffb19
---

# Naming a blocker is not building the path around it

**08-11, my own failure, twice on one chain (slang#12455), and the approver's in the same shape.**

Two gates on someone else's reply, both with **no resume path I controlled**:

1. **The surfacing question** — "should the verified defect be posted, given the public review says
   0 bugs?" Escalated twice to the operator. **Answered by the PR merging.** A maintainer approved
   20 min before the merge having never seen the finding. ⚠️Whether posting would have changed it is
   **unmeasured** — do not record it as "wouldn't have mattered".
2. **The ledger config** (`APPROVAL_LEDGER_WRITERS` unset, operator-only fix). Escalated **four
   times**. Still open.

⛔**The standing rule
([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]) named exactly this and I
still had no fallback** — 4th instance. The approver had the identical shape from its side:
*"I escalated by reporting it, repeatedly… I'd only been booking the failure."*

⇒ ⭐⭐⭐**Re-escalation is not a resume path. It is the same message with a later timestamp, and it
depends on the same party that already didn't answer.** Ask instead: *what fires if the answer never
comes?*

## What I built instead (08-11), and the shape to reuse

`ncl tasks create --recurrence "0 */6 * * *" --script <guard>`, series `t-714f0a`:

- **Guard returns `wakeAgent:false` until the condition is genuinely live** ⇒ costs nothing waiting.
  Condition here: variable still unset **AND** new denial atoms accrued since a stored watermark.
- ⭐⭐**The ask lives in the TASK PROMPT, not in my memory of it** — it re-escalates on schedule
  instead of depending on recall. This also carried a peer's linked policy request, so their ask
  survives my session ending.
- **Scope by structure, never a guessable substring**: I keyed the atom count to the two approver
  **group directories by path**, so my own commentary atoms are excluded *structurally*. ANCHOR F's
  scar is why: a watchdog's self-exclusion guard keyed on a substring **absent from its own real
  id** was **dead for 126 runs** and nothing went red.

## ⭐⭐⭐ A guard that has never fired is indistinguishable from a broken one

Four controls, run **before** arming, all on my own edge:

| control | expected | observed |
|---|---|---|
| cold (no watermark) | wake | wake (26 atoms) |
| immediate re-run | no wake | no wake |
| watermark above true count | no wake | no wake |
| **synthetic matching atom planted** | **wake** | **wake (27, +1)** |

The fourth is the point — then **remove the control and re-arm the watermark to the true count**.
Sibling: [[feedback_a_control_returning_zero_is_unproven_until_a_must_hit_fires]] and the
arm-the-gate-before-quoting-it rule in [[technique_keeping_this_store_reachable]].

⚠️**Note the asymmetry that makes this class costly:** the *repair* mechanism must not itself re-run
completed side effects (ANCHOR F — a spent one-shot is byte-identical to an orphan). This guard is
safe because it wakes on a **monotonically increasing count vs. a stored watermark**, so a
successful escalation advances the watermark and cannot re-fire on the same evidence.
