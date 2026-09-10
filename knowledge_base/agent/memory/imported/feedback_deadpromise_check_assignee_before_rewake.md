---
name: feedback_deadpromise_check_assignee_before_rewake
description: "Before a dead-promise re-wake nudge, check the issue assignee — self-assigned core maintainer ⇒ stand-down, not re-wake"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: eb477676-0086-49a8-8bc0-499312dbdbdd
---

When the supervisor's #12002 dead-promise carve-out fires (fixer-owned, no-PR, silent ≥ threshold, bot promised a PR that never landed), **check the issue's GitHub assignee before nudging the fixer to re-wake**. If the issue is self-assigned to a core maintainer — especially the author of the framework our fix would extend — the correct response is **stand-down / advisory:maintainer-driving**, NOT re-wake into a competing bot PR. The assigned-maintainer stand-down rule (assigned maintainer ⇒ competing bot PR gets closed even when technically correct) outranks the dead-promise signal.

**Why:** On tick 86 (07-14) I nudged slang#11970 as a dropped promise (bot said "draft PR ETA ~20min" 07-11, no PR 3d later). The facts were right, but slang-triager corrected it: #11970 was self-assigned 07-08 by jhelferty-nv, author of #11331 (the Metal buffer-element-type lowering framework our Approach-B fix extends). A bot PR there is counter-productive; our durable value was the advisory analysis already posted. Root data-gap: #11970's disposition was blank in supervisor-state, so `scan.py::we_owe_next_step` fired the carve-out (it correctly excludes maintainer-driving dispositions when they're recorded).

**How to apply:** (1) Persist maintainer-driving dispositions to supervisor-state promptly so the carve-out self-suppresses next tick. (2) For any dead-promise candidate, `gh issue view <n> --json assignees` before the nudge — a core-maintainer self-assignment flips re-wake → stand-down/advisory. Contrast [[project_11970_metal_bindless_msl]] (stand-down, corrected) with slang#9999 (genuine re-wake — assignee jhelferty *asked the bot* to prepare the PR, so we own it). Related: [[feedback_let_fixer_own_single_session]], [[feedback_supervisor_autonomous_authority]].
