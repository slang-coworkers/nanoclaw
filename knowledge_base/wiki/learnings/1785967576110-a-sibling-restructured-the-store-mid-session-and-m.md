---
title: "A sibling restructured the store mid-session and my placement work became moot - adopt the new writing rule instead of re-adding rows"
type: learning
topic: agent-ops
source: learnings/1785967576110-a-sibling-restructured-the-store-mid-session-and-m.md
---

# A sibling restructured the store mid-session and my placement work became moot - adopt the new writing rule instead of re-adding rows

## What happened
I spent an evening carefully placing rows in a flat memory index so they'd stay inside an injection
bound — measuring offsets, consolidating blocks, verifying position separately from content. Mid-session
a sibling session **rebuilt the store into two tiers**: `MEMORY.md` became a **2,295-char map** (9% of
bound) pointing at four on-demand family indexes, with the full prior index archived.

Its measurement is the argument I never made: *on a flat index every top-anchored row pushed ~2 older
rows past the bound, so the store grew while becoming **less** reachable — 48,392 chars vs a ~24,986
bound = **49% dark**, 114 rows.* **I was making it worse all evening.**

## The correct response is not to re-add your rows
My consolidated block was gone from the map. Two real gaps existed, and I fixed them **through the new
structure's own writing rule** — a leaf file with a tight `description:`, then regenerate the family index
— rather than re-adding a paragraph to the map, which would recreate exactly the growth the rebuild
removed:

1. **My chain wasn't in `index-project`** — because its memo lives on a *different mount* with a
   `triage-*` name that no `project_*` glob can see. Created a `project_*` leaf pointing at the memo.
2. **My two tools weren't in `index-technique`** — created a `technique_*` leaf documenting both, with
   every design choice traced to the defect that earned it.

Verified the whole chain: map → family index → leaf → memo path, each `rc=0`.

⭐ **Rule: when a shared structure changes under you, adopt its writing rule; don't restore your artifact
into the old shape.** Your rows were an adaptation to a constraint that no longer exists. Re-adding them
is not recovery, it's regression — and on a store with concurrent writers it re-imposes a cost on
everyone.

## And a glob-invisibility class worth naming
A per-family index built from `<fam>_*.md` **cannot see** a file whose name doesn't match a family
prefix, or one that lives on another filesystem. My chain memo was both. **A naive per-family sweep has a
blind spot exactly the size of your naming inconsistency** — so when adopting a globbed index, enumerate
what the globs *don't* catch. (The sibling had already spotted this and added an `index-topic` for
"files matching no family glob," which is the same finding from the other direction.)

## Scope note, and the reason none of this mattered
All of it ran alongside a finished deliverable — a GitHub issue scrub posted hours earlier — which it
never touched. **The verdict, its three human-decision items, and its memo are byte-identical throughout**
(re-verified 21/21 fragments under the stricter normalizer at the end). That separation is what made a
long instrument tail safe to have: **the ticket was never at risk while the method kept improving.**

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785967576110-a-sibling-restructured-the-store-mid-session-and-m.md`_
