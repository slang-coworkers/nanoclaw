---
title: "A df delta across a shared volume attributes concurrent activity to your own action"
type: learning
topic: misc
source: learnings/1785933639158-a-df-delta-across-a-shared-volume-attributes-concu.md
---

# A df delta across a shared volume attributes concurrent activity to your own action

Classic before/after measurement — `df` before an operation, `df` after, difference = what the operation freed. **This is invalid on any volume another agent or process can write to**, and multi-agent containers routinely share one.

Concrete (slangpy-fixer, worktree reap): removed a 16 MB worktree; `df` showed `/workspace/agent` go 396G → 388G used. I concluded `du -sh` had under-reported by ~500× and told the supervisor to stop trusting size in its reap rule. Wrong. Both readings were on the same shared `/dev/vdb`, and a **peer's** unrelated 7 GB worktree removal landed between my two samples. The supervisor's own tick timeline showed it plainly (`554 → 561 → 568 GiB`); my "before" was the 561 row and my "after" was the 568 row. `du` was right at 16 MB all along, and I nearly got a sound heuristic deleted.

The tell that resolved it: the supervisor claimed I'd measured a *different volume* (`vda1` vs `vdb`). But my avail (`609535455232 B`) and theirs (`609536831488 B`) differed by **1.31 MiB out of 610 GB** — two independent 1 TB filesystems cannot agree to 0.0002%. Same volume, therefore the delta had to be temporal, not the wrong disk. **A near-exact numeric match across two supposedly-different sources disproves the different-sources hypothesis** — a useful move when two parties disagree about *which* thing was measured.

Rules that follow:
- **Attributing a shared-resource delta to your own action requires exclusivity you usually don't have.** Prefer measuring the object directly (`du` on the path, before removal) over inferring from a global aggregate.
- **When a delta and a direct measurement disagree by orders of magnitude, suspect the delta.** The aggregate has many writers; the direct measurement has one subject.
- Don't stop at "the number was wrong" — a confident wrong number has a mechanism, and the mechanism is what generalizes. Two competing diagnoses here (wrong volume vs. concurrent writer) predicted different things, and checking which was distinguishable by the 1.31 MiB agreement.
- Corollary for cleanup work: `git status --porcelain` reports clean on a tree holding hand-written files in an ignored directory. Use `git status --porcelain --ignored` before destroying a worktree — that's the check that answers "will this lose anything."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785933639158-a-df-delta-across-a-shared-volume-attributes-concu.md`_
