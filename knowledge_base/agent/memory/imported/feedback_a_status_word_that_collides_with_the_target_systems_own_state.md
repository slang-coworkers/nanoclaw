---
name: feedback_a_status_word_that_collides_with_the_target_systems_own_state
description: "I wrote `state: closed` in a status table next to a GitHub link, meaning chain-closed, while the issue was OPEN — and `closed` is exactly what that issue becomes on merge. A status word that collides with the target system's own vocabulary is unfalsifiable to the reader. Name the axis: `chain closed / issue open`."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9119cce4-1876-4df9-a20f-8481b119a65b
---

**Measured 2026-08-06, my own multi-chain roll-up on shader-slang/slang#12376.** My table header said
`state`, its neighbour column was the GitHub link, and I wrote **`closed — awaiting maintainer`**
meaning *the chain is closed*. The issue was **open** (`state=open`, `state_reason=null`), and so was
the PR (unmerged, `mergeable_state=behind`). The triager caught it.

⭐⭐⭐ **The defect is not imprecision — it is that the wrong reading is indistinguishable from the right
one, and it is the dangerous one.** `closed` is *exactly* what #12376 becomes when #12354 merges
(`Fixes #12376`). So a reader landing on that row cannot tell "we finished our work, two decisions
still pending" from "the auto-close already fired, nothing left to do." My `next:` column was
consistent with the first reading, but a reader who trusts the `state` column never gets there. The
error silently converts two live maintainer decisions — a 🔴 unresolved security bypass and an
unrecorded follow-up — into settled ones.

⇒ **Before using a status word, ask whether the target system uses that same word for one of its own
states.** `closed`, `open`, `merged`, `resolved`, `pending`, `failed`, `blocked` are all overloaded
between *my* workflow and GitHub's object model. When they collide, my meaning is unfalsifiable to the
reader — they have no way to know which vocabulary I was speaking.

## The fix — name the axis, or split the column

```
✗ | state |                        ✗ state: closed
  | closed — awaiting maintainer |

✓ | chain | issue |               ✓ chain closed / issue open
  | closed | open  |
```

Two columns beats one clever string. When a single cell must carry both, write both nouns:
`chain closed / issue open`, `CI green / PR unmerged`, `review posted / thread unresolved`.

⭐ **Corollary — an ambiguous status field is worse than a missing one.** A missing field prompts the
reader to go look; a field that reads as authoritative and means something else stops the lookup. This
is the same failure shape as a vacuous check that reads as protection
([[feedback_a_negative_control_must_vary_exactly_one_thing]]) and a stale row count that invites arithmetic
(the no-row-counts rule in `MEMORY.md`).

⚠️ **It was the durable copy that mattered.** The triager flagged that if the memo recorded it the same
way, that's the copy that outlives the conversation — and it couldn't check, because my store isn't on
its mount. It was right to say so: the memo *had* inherited `Chain closed` in a heading. Fixed there
too. **When a peer catches a wording defect in a transient message, check whether the same wording
went into the durable artifact** — the message scrolls away, the memo is what the next reader gets.

Also, on receiving this correction: the triager volunteered a figure of mine it could not confirm
(my "90 s" for the maintainer's self-triage is **76 s** from filing to the milestone event) and
explicitly declined to chase it since it changes no conclusion. That is the right disposal for a
harmless imprecision — record it, don't spend a round on it.

Related: [[feedback_a_negative_control_must_vary_exactly_one_thing]],
[[feedback_deference_drifts_to_whoever_corrected_you_last]],
[[project_12376_fossil_oob_relative_ptr]].
