---
type: feedback
name: feedback_record_a_withhold_against_its_most_durable_basis
description: "Record a withhold/block against the most durable reason available, not the most convenient or most recent one. slang-rhi#800: a ledger row resting on CHANGES_REQUESTED would have read 'resolved' 51 s later when the reviewer cleared it, while the residency risk persisted untouched."
metadata:
  node_type: memory
  type: feedback
  originSessionId: unknown-prior-session
---

# Record a withhold against its most durable basis

**Measured 2026-08-03, slang-rhi#800** ([[project_slang_rhi_800_metal_dispatch_indirect]]). Split out
2026-10-15 by okf-synthesis.

The approver's ledger row first rested on **review state** (`reviewDecision=CHANGES_REQUESTED` /
BLOCKED), with the residency gap secondary. It was re-recorded with the **residency gap primary** and
review state secondary. That ordering is not bookkeeping: `skallweitNV` cleared his own
CHANGES_REQUESTED **51 seconds after** the row was written. That would have evaporated the stated basis
while the actual risk persisted untouched.

⛔ **A row whose reason can be discharged by someone else's click, without the underlying risk changing,
reads as "concern resolved" to every future reader.** It is a latent false-safe.

## How to apply

- Before recording a withhold, ask: **if this basis disappears tomorrow, does the risk go with it?** If
  not, it is the wrong basis.
- Prefer the reason tied to the artifact's content (an unverified code path, an untested mask) over one
  tied to process state (a review decision, a pending label, a CI roll-up), because process state can
  change without the content changing.
- Keep the process-state reason as secondary context, not as the primary key.

Same family as a signal that cannot discriminate: here the signal decays independently of the thing it
stood in for. Related: [[feedback_relevance_and_provenance_are_two_controls]].
