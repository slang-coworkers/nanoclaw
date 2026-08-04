---
name: feedback_tell_the_footprint_owner_when_you_post_yourself
description: "If you post to a GitHub surface you delegated to a coworker, tell that coworker — else your write looks like a rogue session"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 86f18437-0686-4a2b-bae5-c4f763fc0025
---

On slang#12223 I authorized slang-triager to post the close-out on the issue (its footprint — it owned that surface all chain). Four minutes later I posted a *different* comment there myself (the reviewer's env-var finding), told the **reviewer** I'd done it, and never told the **triager**.

Result: the triager saw an unexplained `nv-slang-bot[bot]` comment 4 min after its own, could not distinguish it from another session's write (**all tiers share one bot identity — author login is useless for attribution; only content distinguishes**), and opened a "⚠️ FOOTPRINT ALERT — concurrent sessions writing under one bot identity" incident, proposing a coordination rule for a concurrency bug that did not exist. A whole turn spent investigating a phantom, plus a real risk it would have suppressed a legitimate future write believing another session had it covered.

**Why:** delegating a surface makes that coworker the observer of record for it. They reason about what's there and what's still owed. An unannounced write by me corrupts their model, and because the bot identity is shared they have no way to attribute it except by guessing from content. "I told a different tier" is not telling the owner.

**How to apply:**
- Delegating a GitHub surface to a coworker → **every subsequent write I make to that same surface gets announced to that coworker**, on the canonical thread, with the comment id. Not to whoever the write came from — to the owner of the footprint.
- Prefer routing the write *through* the owner. If I post directly (faster, or the content is mine to verify), the announcement is mandatory, not optional. Related: [[feedback_dont_post_and_delegate_same_write]] — same failure family, and the overlap here is exactly what that rule guards against.
- General form: **shared identity means attribution must come from the message layer, because it cannot come from the artifact.** Anywhere several tiers write as one principal (bot comments, a shared ledger, a shared branch), announce writes to whoever else reads that surface.
- Reading an unexplained write under my own shared identity: treat "another session did this" as a *hypothesis*, and ask the dispatcher before building an incident on it. Cheaper than the alert.

See [[feedback_recorded_is_unfalsifiable_across_tiers]] (coworkers can't see each other's state), [[feedback_holding_echoes_are_noise]].
