---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-26T08:22:58.418Z
---

# [approver/challenger-miss] Trace the PRODUCER before an "unreachable-couldn't-refute" abstain — read the retry path in isolation, missed the load-time validator

## Symptom
On slang#12446 R10 (on-demand IR loading) I abstained (CHALLENGER_CONCERN) on a
Devin finding: `materializeDeferredBody`'s sizing/alloc walk
(`slang-serialize-ir.cpp:787-791`) skips already-allocated slots on a retry
(`if(!insts()[i])`) without advancing `allocStringLengthCursor`, so a
partial-alloc abort followed by a retry could desync the cursor and mis-size a
string constant → memcpy overwrite. I framed it as "contested reachability +
memory-corruption blast radius, couldn't trace or refute the throw+catch+re-access
chain ⇒ conservative-lean ABSTAIN." The OUTPUT_REVIEW critique (codex) refuted it
and I verified against the head blob: it was an OVER-ABSTAIN. Correct call was
WOULD_APPROVE.

## Root cause
I read the RETRY path (`materializeDeferredBody`) in isolation and treated "a
`SLANG_RELEASE_ASSERT` in `_readInstMinSizeInBytes` can throw mid-walk" as a
reachable partial-alloc state — WITHOUT checking the PRODUCER that runs first.
The load-time alloc walk (`slang-serialize-ir.cpp:1288-1305`) calls
`_readInstMinSizeInBytes` UNCONDITIONALLY for every instruction, INCLUDING
deferred bodies (only `_allocateInst` is gated on `instIsEager`, not the size
read), and it runs BEFORE `setDeferredBodyLoader` installs deferral (`:1315`).
So every string/blob length is range-validated (`len>=0`, `<=UINT32_MAX`,
addition-no-wrap; `:876-885`) at load time. A corrupt length aborts the WHOLE
load before any body is deferred — the partial-alloc-then-retry state I feared
is not reachable. Reinforcers: `flat.stringLengths` is an immutable
`SerializedArray` (`:106`) never re-mutated, so materialization re-reads the same
validated lengths; and the decode memcpy is independently bounds-checked at
`:997-1000` before the copy at `:1011`.

## How to catch it
Before recording an ABSTAIN whose reason is "trigger reachable in principle,
couldn't refute": name the GUARD/PRODUCER that would make it UNREACHABLE and go
read it. A retry/consumer path that operates on data validated by an earlier
producer pass is only exploitable if the producer can leave that data in the bad
state — trace the producer first. "Contested reachability, could-not-refute" is
honest only AFTER you have looked for and failed to find the refuting guard, not
when you simply stopped one function short. For deferred/lazy-load schemes
specifically: the eager load-time skeleton scan usually validates the SAME
immutable serialized data the lazy path later consumes — check whether the
"unvalidated on the lazy path" concern is actually pre-validated eagerly.

## Fix
Adjacency to the rule wasn't enough; the mechanical countermeasure is: for any
abstain built on "a consumer reads X unvalidated," grep the producers of X
(`_readInstMinSizeInBytes` here was called from TWO sites; I read one) and
confirm none validates it earlier. An abstain that survives that trace is real;
one that doesn't is an over-abstain. This is the same genus as "an absence claim
is a claim about a state I did not open" — here the unopened state was the
load-time walk, my own pipeline's first pass. Two-tier critique caught it; the
self-catch would have been reading both call sites of the size function.
