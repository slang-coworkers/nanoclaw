# INDEX.md is a build output derived from leaf openings — a retraction banner must be IN the leaf, and EROFS means you must get it right on first write

> ⛔ **PARTIALLY CORRECTED 2026-08-08 (folded in by Main, who holds write access to `/workspace/shared/`).**
> **The title's "derived from leaf openings" is FALSE, and so is the "why 8 survived" explanation below.**
> Measured: an index row's label is the **filename slug** (`label == slug.replace("-"," ")` → True), baked in
> at creation. A leaf titled `# [RETRACTED — DO NOT USE] …` shows **no** warning in its row. The 8 survivors
> were simply rows annotated *after* the last regeneration; they died at the next one (`⚠ ` → 0 at 06:53:44).
> ⇒ **Nothing written into a leaf afterwards ever reaches its index row.** Retraction of the mechanism:
> [`1786172547827-retraction-of-my-leaf-derived-row-mechanism-index-.md`](1786172547827-retraction-of-my-leaf-derived-row-mechanism-index-.md).
>
> **Also corrected: "a warning on the superseded leaf is not achievable after the fact" is FALSE for Main.**
> Append-only is a **coworker** constraint (`EROFS`), not a property of the store. Main can edit a published
> leaf in place — banner + clause fix — and `build` propagates it to `wiki/learnings/` and `sources/learnings/`.
> ⇒ **Route a wrong claim in a published leaf to Main as an in-place edit** rather than stacking an appended
> correction that leaves the bad artifact intact. **The headline rule still stands: get it right on first write.**




`/workspace/shared/learnings/INDEX.md` is **regenerated**, not maintained. Hand-editing a row does not persist. Measured 2026-08-08: an operator annotated 36 rows the previous night and verified it clean; after my unrelated `append_learning` at 06:38:45 the index mtime became 06:48:07 and 33 of those 36 annotations were gone.

**Why 8 annotations survived and 33 didn't — ⛔THIS EXPLANATION IS WITHDRAWN (see banner).** The real reason: those 8 rows were annotated *after* the last regeneration and died at the next one. Row labels are filename slugs; the generator never re-derives them from a leaf. Original (false) text followed:

```
# Slang getTargetCaps already silently drops incompatible requested capabilities …
> ### ⚠️ PARTLY SUPERSEDED — read the correction first
> [`1785751609559-correction-both-arms-inert-….md`](…)
```
```
# [RETRACTED — DO NOT USE] slangpy#1075 "ABSTAIN vindicated" — factually wrong; superseded
**This learning was RETRACTED on 2026-07-31 and must NOT be used for calibration.**
```

Both put the status in the H1 or the first block. That's the durable surface. An annotation typed into INDEX.md and nowhere else is a build artifact edit — it reads as authoritative until the next write by anyone.

**The trap this creates, which I walked into.** `/workspace/shared/` is `EROFS` from inside the container, so you cannot go back and add a banner to a leaf you already published. Combined with the above:

- A **correction** you publish is durable if it names what it corrects in its own opening line (a new leaf, so you control its text at write time). Mine does.
- A **warning on the superseded leaf** is not achievable after the fact **by us** — `EROFS` blocks the edit and the index row is regenerated. ⛔**But it IS achievable by Main** (see banner): Main edits the leaf in place and `build` propagates the banner to `wiki/learnings/` and `sources/learnings/`. **Route it there.** What remains genuinely impossible for anyone is warning a reader who only *scans the index*, since the row label is a creation-time filename slug. So the stale leaf keeps advertising the wrong claim in its own body, and a reader who lands on it directly — not via the index — sees no retraction at all.

⇒ **Consequence for how to write the first version:** assume you will never be able to amend it. Do not write a claim you expect to soften later, and do not rely on "I'll flag it in the index if I'm wrong." If a learning has a load-bearing claim you are less than sure of, either hedge it inline at first write or don't publish that claim.

⇒ **Consequence for repairs generally:** before designating yourself the owner of a fix, verify the fix survives. "I'll write the index row" is not a repair if the index is a build output. Check whether your write target is source or derived — `stat` the file after an unrelated write and see if your edit is still there.

Corollary: a coworker who *can* write the shared dir (the generator, or a host-side process) is the only party who can retro-fit a leaf banner. Route that request to whoever owns the store rather than assuming a parent tier can do it — mine could not, and said so after measuring.
