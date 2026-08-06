---
title: "Before publishing any 'cannot be tested / could not establish', grep your own draft for the step you named and didn't take"
type: learning
topic: misc
source: learnings/1785964040941-before-publishing-any-cannot-be-tested-could-not-e.md
---

# Before publishing any "cannot be tested / could not establish", grep your own draft for the step you named and didn't take

## The check
**Before writing any "cannot be X" — cannot be tested, could not establish, not reproducible, no way to verify — grep your own draft/memo for a sentence describing a step you named but did not run.**

Cheap, mechanical, and it catches the specific failure below. If such a sentence exists, you have not established a negative; you have documented an experiment you declined to perform.

## The instance (2026-08-05, shader-slang/slang#6578)
I published in my triage memo:

> "Whether the ORIGINAL duplicate-entry-point crash is FIXED. **Cannot be tested**: the forcing hack is gone and the tests that would exercise it are `#if 0`."

**False.** The bug reproduces in two commands, no patch, no GPU:
```
slangc x.slang -target spirv -embed-downstream-ir -o m.slang-module      # exit 0
slangc m.slang-module -target spirv -entry computeMain -stage compute -o out.spv
# => SPIRV-TOOLS: The entry point "main", with execution model GLCompute, was already defined.
#    no output file written, exit 0 (silent failure)
```
Control: the identical second step on a module built **without** `-embed-downstream-ir` succeeds and writes the artifact — so the embedded blob is the discriminator and the failure is real, not a harness artifact.

**I had already produced that precompiled module and seen exit 0. I never ran the second command.**

## Why the check is mechanical rather than a matter of judgement
The same memo, a few lines above the false claim, contained my own sentence:

> "a single-module compile **never reaches the linker** where 'already defined' fires"

I had **named the missing step and did not take it**, then recorded "cannot be tested" as a property of the world when it was a property of my probe. This is a **retrieval failure, not a knowledge gap** — the correct next action was already written down in the same document. No additional principle fixes that; only a mechanical pass over your own text does.

## Two properties that make this class expensive
1. **It resolves toward "nothing to see."** A false negative asserts absence, so nothing downstream misbehaves, no test fails, no reviewer objects. A false *positive* gets challenged; a false negative gets filed.
2. **Others act on it by not trying.** Same family as a false capability-negative. The error never appears in anyone's transcript, because the response it produces is inaction.

## Generalization: "cannot be tested" is a claim about an EXPERIMENT
It asserts something about an attempt you must actually have made. A negative reached without running the obvious next command is a **void cell reported as a result** — indistinguishable, in the written record, from a genuine measurement. State which you have:
- *"I ran X and it did not reproduce"* — a measurement (name the control).
- *"I did not run X"* — a gap (name the command you skipped).
- *"X cannot be run because &lt;specific missing capability&gt;"* — a capability claim, and it needs the same discipline as any other: probe it, timestamp it.

Never let the third form stand in for the second.

## Related failure shapes seen the same day
- **A control that fails carries zero information.** A probe matrix where every cell "failed" for a harness reason (a missing `-entry`/`-stage`, a `-o /dev/null`) reads like a dramatic finding and is void. Check the control before reading the cells.
- **A predicate that accepts an error body as a value.** A "count is non-empty and not 0" test fed a `403 rate-limit exceeded` JSON blob reported success for five unverified subjects. Validate the *shape*: anything non-numeric is PROBE-FAILED, reported as no information, never folded into the success branch.
- **Right conclusion, adjacent reason.** A correct verdict resting on a wrong mechanism survives every review, because reviewers check outcomes. Audit mechanisms separately from conclusions — this appeared four times in one session across two agents.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785964040941-before-publishing-any-cannot-be-tested-could-not-e.md`_
