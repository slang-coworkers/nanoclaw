---
title: "Count the COMPETING actors, not the passing tests — a fixture with one actor cannot tell a correct mechanism from an arbitrary one"
type: learning
topic: misc
source: learnings/1786034992474-count-the-competing-actors-not-the-passing-tests-a.md
---

# Count the COMPETING actors, not the passing tests — a fixture with one actor cannot tell a correct mechanism from an arbitrary one

I reported a fix as "works on three shapes, breaks one." A reviewer pointed out the three couldn't have
detected a defect **even if my mechanism were completely arbitrary** — and following that up produced a worse
failure than the one already found. slang#12155, 2026-08-06.

**The setup.** My change synthesized an identifier (a shader varying index) into a namespace that an existing
pass also allocates into. Measured results, all `EXIT=0`:

| shape | fields competing for a synthesized index | outcome |
|---|---|---|
| g1, h1, h2 | **1** — mine only | "correct" |
| d1 (two out params, no unsemanticed fields) | 1 authority, 2 fields | correct, distinct |
| c4 (one unsemanticed field + one out param) | **2 authorities** | **collision** |
| d2 (two unsemanticed fields + two out params) | **2 authorities, 2+2** | **collision ×2** |

**The critique that mattered:** in g1/h1/h2 exactly one thing is minting an index, so *any* seed value ≥1
renders as plausible output. Those three shapes are equally consistent with my mechanism being right and with
it being arbitrary. They produce green results that carry **zero information about the thing under test**. So
"fixes three, breaks one" was wrong framing: **three of the four never exercised the mechanism at all.**

**`d1` is the diagnostic result, and it's the counter-intuitive one.** Two of my own synthesized fields, no
competitor: indices came out distinct and correct. My allocator is *internally* consistent — it increments
properly and never collides with itself. It is wrong **only relative to the other authority.** Consequence:
**no test of the new code in isolation, at any input size, can find this defect.** It is visible only in a
shape where both minters are simultaneously live. If your test matrix varies the size of *your* contribution
but never puts a competing producer in the same run, it cannot fail.

**And `d2` shows why one such case isn't enough either:** collisions scale with the number of contributed
fields. `c4` was the n=1 member of a family, easy to file as an edge case; `d2` makes it structural.

**The check, before claiming a fix works on N cases.** For each case ask: *could this input distinguish my
mechanism from an arbitrary one?* If the answer is no, it is not evidence — it's a smoke test. Concretely:

- **Count the competing actors in the fixture, not the passing assertions.** One actor ⇒ no discrimination.
- **Construct the case where every relevant producer is active at once**, then scale it (n=2) to see whether
  the failure is an edge case or a family.
- **A green suite is compatible with an arbitrary implementation** whenever the suite's inputs don't force the
  mechanism to matter.

This is the same trap as a cited test that *exits before reaching the code under test* — my other error the
same day, where I justified a guard with a fixture whose parameter carried a semantic and so returned early.
Both are "the fixture never reached the thing," one by control flow and one by insufficient contention.

**Generalizes past compilers:** a lock tested single-threaded, a dedup tested with unique inputs, a merge
tested without conflicts, a cache tested without eviction pressure, a rate limiter tested below the limit. In
each, the passing test is real and the information content is nil.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786034992474-count-the-competing-actors-not-the-passing-tests-a.md`_
