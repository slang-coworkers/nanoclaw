---
name: feedback_compaction_target_yields_to_load_bearing_content
description: "A size/compaction target is advisory; verbatim commands, IDs, and RESUME triggers are not compressible. What a compaction destroys is the IMPERATIVE, not the paragraph — so audit imperatives and discriminators first. Stop at the floor and say so."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# A compaction target is advisory; load-bearing content is not compressible

A hook that optimizes bytes cannot see which byte is the one that prevents a wrong merge. When the
floor is above the target, **stop and say so** rather than deleting load-bearing content to satisfy a
number — an index that fits the limit but has lost its commands has failed at being an index.

This concept was split 2026-09-05; the mechanics live in three siblings:
[[feedback_compaction_harm_is_unreachability_not_bytes]] · row-offset measurement and the ambiguous
bound in [[feedback_compaction_measure_row_offsets_not_file_size]] · concurrent-writer rollback in
[[feedback_concurrent_writer_spills_predecision_row]].

## What a compaction destroys is the IMPERATIVE, not the paragraph

Audit imperatives and discriminators **first**; prose is the safest content in the file. A restructure
rewrites paragraphs into headings and new wording — and they *survive*, because meaning is recoverable
from a reworded explanation. What vanishes is the short operable line. Measured on one migration: of
~20 concepts, 12 of 13 flagged candidates were reworded-but-intact prose, and the single genuine loss
was the imperative — `Ask: what could this never print?` — the one line a later reader would have
*executed*. ⭐⭐⭐ **Fluency is preserved by restructuring; ACTIONABILITY is not**, so the remainder
reads complete and confident while having lost precisely the executable part. ⇒ **Grep for the
imperative verb and the `?`, not for the concept.** "The detail is in the child" is not sufficient —
verify the **command / question / discriminator** arrived, not that the topic is discussed there. Same
asymmetry as [[feedback_a_guard_can_be_inert_and_read_as_passing]].

## The rule

**Compact prose; never compact these:**
- verbatim commands and flags (the reason the note exists — a pointer to a command costs a file-open at
  the exact moment you need it, which is what the note exists to prevent)
- identifiers you'd otherwise re-derive: SHAs, PR/issue/comment IDs, `file:line`
- RESUME triggers on live chains, and the ⛔/⚠️ traps that prevent a wrong action

**Sequence that works:** dead-link/reachability check first → for each candidate row, `grep` the child
for the specific fact → only then shorten → re-verify links and spot-check that named commands/IDs
survived. Fold **pointer-only rows** (a row whose whole content is a link) before trimming substantive
ones — it costs one hop and risks nothing. **Sort candidates by how little they'd lose, not by length.**
And verify a row's state live before compacting it — that is what lets you shorten it *honestly* (rows
get more accurate, not just shorter). ⭐ **Trim your OWN newest line first** — being freshly-authored is
not a claim to space; most runaway growth is self-referential commentary about the compaction trigger,
not chain state.

## The verification probe is itself an instrument that lies — ladder every zero

The "is it in the child?" `grep -ciF '<exact index phrasing>'` probe is a **narrower** instrument than
the prose it tests, so a 0 means "my probe missed" at least as often as "the content is gone." Run over
20+ fragments in one pass, nine came back 0: six were phrasing variants (`doesn't` vs `does not`,
`V1/V2` vs `Variants 1 & 2`) that were already safe, and three were real losses existing only in the
index line (the sharpest: an `EDIT-in-place, never re-POST` operational rule whose child recorded the
comment id but not the *consequence*). ⇒ **Ladder every zero** (shorter stem → `-E` alternation →
synonym) before deleting on its strength, and note the asymmetry that sets the default: **a false 0
costs bytes; a false non-zero costs the content permanently.** When the ladder is ambiguous, write it to
the child anyway — duplication is cheap, deletion isn't. ⭐⭐ **The check that authorizes a deletion
needs the same rigor as the claim it's checking.** Re-read the child before acting on a 🔴 row: a stale
alarm outlives the thing it alarms about and looks identical to a live one.

## ⛔ Sole-copy / cross-session-append banner — read before compacting this file

A file in a memory dir is **not** evidence of who wrote it: appending to another session's file makes
the content look like the owner's, and the owner can then compact it away without knowing the stake.
`originSessionId` is the owner, not the author of every line — check it before citing a file as your own
prior finding, and banner the stake when you append across sessions. **Do not delete any rule here (or
in the three siblings) without first landing it elsewhere and verifying the exact wording arrived** —
the harm is unreachability, and the mitigation is adding a path, never dropping a row (lifeboat links
give a file a second parent that survives a tail cut:
[[feedback_a_correct_conclusion_does_not_certify_its_recipe]],
[[feedback_stop_a_converged_exchange_the_yield_curve_bends]]).
