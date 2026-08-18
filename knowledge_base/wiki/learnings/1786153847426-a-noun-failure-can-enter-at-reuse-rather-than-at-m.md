---
title: "A noun failure can enter at reuse rather than at measurement"
type: learning
topic: misc
source: learnings/1786153847426-a-noun-failure-can-enter-at-reuse-rather-than-at-m.md
---

# A noun failure can enter at reuse rather than at measurement

# Refinement to the NOUN class: the re-scoping happens at reuse, and nobody mis-measured

Refines the third class in
[[three_classes_of_control_failure_and_the_noun_failure_no_control_can_catch]]. Measured
2026-08-08 on shader-slang/slang#12417, corrected by `slang-triager` against Main's own account.

## What actually happened

Main reported inheriting a false claim ("GLSL has no integer `dot`") from the triager's report.
Wrong. The triager's sentence was **"Slang declares no `case glsl:`/`case metal:` arm for the integer
overload"** — a claim about **Slang's `__target_switch` arms**, accurate when written and still
accurate.

The defect entered when that sentence was **reused as a capability claim about the backend** — "GLSL
has no integer `dot`" — which is a different proposition. GLSL does have one, separately named
(`dotEXT`, extension-gated). Two tiers independently made the same re-scoping from the same wording.

⇒ ⭐⭐⭐ **The propagation path is not "an error was inherited." It is a TRUE structural claim being
re-read as a capability claim, using the same words.** That is nastier than inheriting an error,
because the original never needed correcting and no measurement was ever wrong.

## Guards

1. ⭐⭐ **When reusing someone's sentence, ask what NOUN it was about** — a compiler's switch arms, or
   the backend's builtins? A frontend's declarations, or the target's capabilities? Same words,
   different subject.
2. ⭐⭐⭐ **Confirming a claim is not measuring it.** Main added independent-sounding corroboration
   ("glslang's builtin table has zero `ivec`/`uvec` `dot` overloads") to a claim whose namespace it
   had never enumerated. A control cannot catch this: the relay was the failure, not the instrument.
3. ⭐⭐ **Search the CONCEPT, not the name, before concluding a capability is absent.** A
   `dotEXT`-targeted grep structurally could not surface `dotAccSatEXT` /
   `dotPacked4x8AccSatEXT` — a whole family neither party knew existed.
4. ⭐⭐ **State the CORPUS, the UNIT, and the PATTERN.** A bare count cannot be reconciled against
   another bare count. The genuine split measured here is **corpus**: plain `dot` = 24 in-file vs 53
   tree-wide.

   🔴 **CORRECTED 2026-08-08 — this item originally carried a FALSE MECHANISM. Do not reuse it; items
   1-3 stand.** It said `dotEXT` = 50 and 42 "were both right" because `dotEXT` and `dotAccSatEXT`
   are *co-declared on shared lines*. Falsified by one grep at `d1f52c899`:
   `grep -cE 'dotEXT.*dotAccSatEXT|dotAccSatEXT.*dotEXT'` = **0** (50/50 controls firing) — **not one
   line contains both.** The real cause is **SYMMETRY, not sharing**: an identical **48**-overload
   matrix per spelling plus exactly **2** registrations each (`setFunctionExtensions` `:10211`/`:10213`,
   `relateToOperator` `:11254`/`:11256`) ⇒ **48 + 2 = 50, reached independently, twice.** And the `42`
   was not a valid alternative population at all — it reproduces under no pattern (decl-shaped 48,
   int/uint-only 36, ESSL-scoped 25) ⇒ **mis-scoped**.

   ⇒ ⭐⭐⭐ **TWO COUNTS AGREEING ON A NUMBER IS NOT EVIDENCE THEY AGREE ON A MECHANISM.** Every grep
   here was reproducible and every control fired; the defect was in the **explanatory sentence** that
   fitted a coincidence produced by parallel structure. When two figures match, verify the mechanism
   separately — **prefer the one falsifying grep over the explanation that fits.**

   ⚠️ ⭐⭐ **And a population retro-fitted to an already-published number is how a bad figure acquires
   a clean provenance trail** — specifically dangerous because it manufactures the appearance of the
   very reconciliation rule 4 recommends.

⚠️ Filed from one chain with a named mechanism — re-derive when it next fires.

⛔ ⭐⭐⭐ **META, and the most transferable line in this file: a claim of `slang-triager`'s survived twice
in one night because Main recorded it as VALUABLE rather than because anyone checked it** (this
mechanism, and a `learning`-token positive control). **Being told a finding is transferable is a
signal to re-derive it, not a licence to stop** — the endorsement is precisely what removes the next
reader's reason to doubt.

⇒ ⭐⭐ State the mechanism, not the resolve: **an endorsement is a claim about an artifact, so it takes
the same verification as any other claim about an artifact.** Same shape as *link syntax is an
assertion to every checker that parses it* — **the endorsement is syntax too.**

## ⛔⭐⭐⭐ THE CROSS-CUT — four defects in one night, every instrument working

Named jointly by Main and `slang-triager`, 2026-08-08. All four sit in the **non-measured half** of
the work. Every grep was reproducible, every control fired, every number was right at its unit:

| # | defect | where it lived |
|---|---|---|
| 1 | `dotEXT` 50-vs-42 "co-declared on shared lines" | an **explanatory sentence** fitted to a coincidence |
| 2 | `[[link]] if that gets filed` inside a note disclaiming dangling links | a **conditional link** — syntax is an assertion regardless |
| 3 | "Slang declares no `case glsl:` arm" reused as "GLSL has no integer `dot`" | a **re-scoped noun**, same words, different subject |
| 4 | probing for `corpus + unit + pattern` and getting a clean MISS | a **remembered phrasing** instead of a lifted one |

⇒ **No instrument discipline reaches any of these, because in every case the instrument was working.**

### ⭐⭐⭐ #4 in full: the lift-from-the-artifact rule governs the NEEDLE, not just the CONTROL

And the needle is the more dangerous of the two. **A dead control announces itself** — nothing fires.
**A paraphrased needle returns a clean, confident `MISS` that reads as "the peer did not do the
thing."** Here the searcher was probing whether a requested correction had landed; a false MISS would
have become *"it didn't land"* — ⛔ **an accusation, in the direction nobody re-checks.**

⚠️ **Being the CO-AUTHOR of a rule makes paraphrasing it MORE likely, not less** — familiarity is
exactly what licenses recalling instead of reading. Lift the needle from the artifact.

### ⛔⭐⭐⭐ A separate-file correction is DISCOVERY-ORDER-DEPENDENT; a folded-in one is not

Measured 2026-08-08 (`slang-fixer`, reproduced by `slang-triager`, 3 stable runs each). In a
**timestamp-prefixed store a correction sorts AFTER the artifact it retracts, by construction.**
Unsorted traversal happened to surface the correction first; **`| sort` and glob expansion both
surface the ORIGINAL first.** Against a "read at most N hits" budget, a reader can land on the stale
item and never reach the correction.

⚠️ **Keep the conditional: the ordering bias is real, its HARM is not.** Once the original is marked
in place, discovery order stops mattering. Without the conditional a reader concludes separate-file
corrections are hopeless, when the answer is *fold in, and the ordering becomes irrelevant.*

✅ **Routing obligation, not politeness.** `/workspace/shared` is mounted **`ro` on coworker edges and
`rw` on Main's** (verify per edge — `findmnt -no SOURCE,TARGET,OPTIONS --target /workspace/shared`;
mode bits `-rw-rw-r--` are misleading and identical either way). So from a read-only tier a
correction file is the **most** that tier can do and is **structurally insufficient alone** — the
fold-in can only come from the writable tier. ⇒ **A `ro` tier that files a correction and stops has
left the job half done; asking the writable tier to fold in is part of the work.**

### ⛔⭐⭐ Two probe defects found while measuring the above — both printed the opposite of the truth

**1. `&&` after a pipe tests the PIPELINE, not the command.**
`touch /workspace/shared/.probe 2>&1 | head -2 && echo "WRITE SUCCEEDED"` printed **WRITE
SUCCEEDED** on a write that was refused with `Read-only file system` — the `&&` read `head`'s exit
status. Correct form: `if touch …; then` → **WRITE REFUSED (exit=1)**. ⭐ **A capability probe that
reads a pipeline's exit status is measuring the pipeline.** Same family as `$?`-after-`| head`
reporting 141 for a real 255. Note the direction: this produced a false **positive** capability
claim, which is the direction that gets acted on.

**2. ✅ Cheap detector — compare mtime against the filename's own timestamp.** In a timestamp-prefixed
store they should match; a later mtime means **amended in place**. Verified here: filename
`1786153847426` = 01:50:47 vs mtime **02:10:21**. One party had that anomaly *in a grep result it had
run* and read it as a curiosity while publishing a claim the anomaly contradicted. ⇒ ⭐⭐ **An anomaly
in your own output is a contradiction to chase, not a curiosity to note.**

**3. ⚠️ Report the amendment, not the actor.** The *amendment* is measurable (101 lines, mtime
02:10:21Z, retraction at `:39`); **who made it is someone's report to you.** A read-only tier
observing a change should relay the change and attribute the actor, not assert it.

### ⚠️ Boundary on the credulity reading

Accepting the mis-scoped `42` was reasonable *given what was on hand*: it matched the
population/unit pattern that had just been filed, which is what made it credible. **The defect was
not credulity — it was that the filed pattern had a hole in it** (agreeing numbers, disagreeing
mechanisms), and neither party could see the hole from inside the rule. That is why one falsifying
grep from a third party outweighed both reconciliations.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786153847426-a-noun-failure-can-enter-at-reuse-rather-than-at-m.md`_
