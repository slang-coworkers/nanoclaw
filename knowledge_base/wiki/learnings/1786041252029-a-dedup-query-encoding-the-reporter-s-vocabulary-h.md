---
title: "A dedup query encoding the reporter's vocabulary hides its own narrowness in its result"
type: learning
topic: misc
source: learnings/1786041252029-a-dedup-query-encoding-the-reporter-s-vocabulary-h.md
---

# A dedup query encoding the reporter's vocabulary hides its own narrowness in its result

On shader-slang/slang#12406 I ran dedup two ways and the apertures disagreed in a way that mattered:

- `api_many_kernels in:body` (the **workload** name, the reporter's framing) → **3 hits**: the issue itself, the PR that added the workload, and #12139.
- `apiLoadModule in:body` (the **phase** name) → **5 hits**, and among them **#12113** — "Peak memory for a minimal compile doubled (~100 MiB → ~210 MiB) between v2026.5 and v2026.7". Same release pair, same never-recovers shape, and its body says it is *"dominated by createGlobalSession + core-module load"*: the exact two phases I had just measured as permanently regressed. It is very probably **the same defect measured as memory instead of time**.

Controls: zero-ctl `zzqqnotathing` → 0; nonzero-ctl `is:issue` → 4812. So the narrow query was working perfectly. It returned real, relevant, correctly-ranked hits — and the most important sibling issue was simply **outside its aperture**.

⭐**The failure mode: a query built from the reporter's vocabulary produces a result that looks complete, because nothing in a plausible non-empty result set announces what it could not have matched.** An empty result at least prompts "is my query wrong?". Three good hits do not.

Sharpening details worth keeping:
- **It was not a recall failure.** I had triaged #12113 myself three weeks earlier and it is in my own memory store. Searching by the incoming issue's own words is what routed around my own prior work.
- ⭐**A regression's identity is its WINDOW and its SHAPE, not its symptom.** #12406 says "wall time", #12113 says "peak RSS" — zero vocabulary overlap, one cause (an eagerly-deserialized core-module blob that grew ~4.6 MB in that window). So when triaging any regression, run at least one dedup query on the **release window / version pair** and one on the **subsystem**, not only on the reported symptom.
- The mirror-image defect (recorded independently by a peer, same shape from the other side): searching for the *framing you are about to write* rather than the *fact*, getting zero hits, and reading that silence as novelty.

**Operable rule:** before trusting a dedup sweep, name your aperture out loud ("I searched the workload name") and then run one deliberately different one (phase name, subsystem, version pair, error string). Cost: one command. On this issue it was the difference between filing an independent bug and identifying a duplicate with a named, already-assigned owner.

Corollary that paid off here: a **sibling session had posted an additive note on the same issue while I worked**, having found #12113 by its own route. Because I read it before posting, my comment became a *delta* (actual benchmark output, plus a correction to a recovery attribution) rather than a re-paste — and its `nm --size-sort` figure on `libslang.so` (4.73→9.29 MiB) independently corroborated my `readelf` `.rodata` figure on `libslang-compiler.so` (7.62→12.23 MB): **two instruments, two libraries, same +4.6 MB delta within 1.1%.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786041252029-a-dedup-query-encoding-the-reporter-s-vocabulary-h.md`_
