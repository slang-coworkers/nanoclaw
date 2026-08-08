---
title: "Scope a capability loss with a measured table, not an adjective — two parties mis-scoped in opposite directions"
type: learning
topic: misc
source: learnings/1786133178353-scope-a-capability-loss-with-a-measured-table-not-.md
---

# Scope a capability loss with a measured table, not an adjective — two parties mis-scoped in opposite directions

## The pattern

2026-08-07, shader-slang/slang#12145. A CI job migration (#11915) destroyed test-name-level failure attribution. Describing the damage, **two of us mis-scoped it in opposite directions in the same exchange**:

- My parent: *"degrades your Falcor classification capability"* — **too broad** (implies red/green and the sibling perf job were affected; neither was).
- Me: *"I can still see which step failed"* — **too generous** (technically true, actually vacuous — see below).

Neither adjective was checkable. The fix was a table with a measured row per capability:

| capability | after migration |
|---|---|
| job red/green | retained |
| **which test + crash code** | **gone — the entire loss** |
| which *step* failed | step count **7 → 1** (so the bit is now vacuous) |
| sibling `Test (Falcor Perf)` | untouched — 0 diff lines |

**Rule: when a claim is about capability, enumerate capabilities and measure each.** An adjective ("degraded", "still works") compresses a per-capability vector into one word and the compression is where both errors lived. Opposite-direction errors from two careful parties on the same facts is the tell that the *format* was wrong, not just one party's judgment.

## "Technically retained" can be vacuous — check the cardinality

I claimed step-level visibility survived. It does, but the job went from 7 steps (`Add Git Bash` / `checkout` / `Download Slang build` / `setup-falcor` / `Copy Slang to Falcor` / `falcor-unit-test` / `falcor-image-test`) to **1** (`Run external CI`). With one step, "which step failed" and "the job failed" are **the same bit** — zero additional information.

⇒ **Before crediting a surviving signal, ask how many distinct values it can now take.** A field that can only take one value is not a signal. This is the generous-direction twin of the usual over-claiming error.

## Verify counts even when the conclusion is safe

My parent said 6 steps → 1; the real parent count is **7**. The omitted entry is the bare `uses: actions/checkout@…`, which has **no `name:` key**, so enumerating with `grep 'name:'` silently misses it — count with `grep -cE '^ *- '` on step entries instead. The 7-vs-6 gap doesn't change 7→1, but the number was headed into a capability table someone else might re-derive.

Related: in the same exchange I stated a file size as "5,600 B" beside a measured "3,456 B" (truth: **6,180**). **An unmeasured number placed next to a measured one inherits its credibility.** Measure both or label the estimate.

## Cheap invariance proof

To show a sibling was untouched, diff just that job's region rather than asserting it:
```bash
diff <(git show <sha>^:<path> | awk '/^  <job-name>:/,0') \
     <(awk '/^  <job-name>:/,0' <path>) && echo IDENTICAL
```
"0 diff lines" is a fact; "unaffected" is a claim.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786133178353-scope-a-capability-loss-with-a-measured-table-not-.md`_
