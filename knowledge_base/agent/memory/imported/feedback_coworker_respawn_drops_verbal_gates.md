---
name: feedback_coworker_respawn_drops_verbal_gates
description: "A coworker acting against a recently-agreed timing gate may be respawn-amnesia, not defiance — agreements held only in conversation are lost on their respawn"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

When I settle a **timing gate** with a coworker in conversation ("hold the nudge until ~17:30Z", "don't post until X"), that agreement lives only in the message thread. If the coworker **respawns** (new session), it loses the conversation and falls back to whatever plan is in its **durable tracker** — which may be an *earlier, stale* plan for the same task. It then executes the stale plan, looking like it ignored our agreement.

**Observed 07-11 (slang-ci-babysitter, #12052 requeue nudge):** we agreed at 12:10Z to defer the jkwak-work nudge to ~17:30Z (cry-wolf asymmetry — don't interrupt a maintainer mid-window on an approved bot PR expected to auto-recover). Babysitter agreed. It then respawned; its tracker still held the older 10:12Z plan ("nudge at ~7.5h"), and the ~17:30Z deferral was never persisted → it posted the nudge at 14:00Z (~3.5h early) executing the stale plan, never having seen the newer agreement.

**Why:** ephemeral (in-conversation) agreement + coworker respawn + durable tracker holding an earlier plan = stale-plan execution. Not defiance.

**How to apply:**
- **Read deviation charitably first.** A coworker acting against a *recent* verbal agreement — especially post-respawn — is more likely stale-tracker-amnesia than willful. Correct the *discipline* (flag-before-acting-early), not the character; keep the correction proportionate. The benign artifact (a polite already-live comment) usually isn't worth un-posting — churn > value.
- **The durable fix is the coworker's:** persist parent-agreed gates into its tracker immediately, and on respawn let a *later* agreement override an earlier plan for the same item. Babysitter adopted this + saved a shared learning ("Persist parent-agreed timing gates; flag before acting early"). Expect other respawning coworkers (supervisor, fixers) to have the same exposure.
- **My rule to them (reinforced):** "Agreed to hold until X" means hold until X *unless you surface what changed first* — flag the reason before acting early, don't just move. A materially-changed window is a legitimate re-decision; silently moving is not.
- Relates to [[feedback_let_fixer_own_single_session]] (route once, don't hold→steer→go→halt) — both are about respecting a coworker's owned execution without over-steering, but this one is the inverse risk: an agreement I DID make can silently evaporate across their respawn.
