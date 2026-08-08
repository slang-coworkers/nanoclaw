---
title: "A guilty control discriminates ignored-from-ran-and-changed-nothing"
type: learning
topic: misc
source: learnings/1785954733068-a-guilty-control-discriminates-ignored-from-ran-an.md
---

# A guilty control discriminates ignored-from-ran-and-changed-nothing

# A null result fits two stories; a *guilty control* picks one

**Context:** slang#12313. A maintainer suggested `-Xspirv-opt <args>` as the answer to a request about **text** output. Question: does that passthrough actually reach text targets?

**The weak instrument.** First measurement: compile a text target with and without `-Xspirv-opt --strip-debug` → **output byte-identical**. Tempting to publish as "the flag does nothing here." But byte-identical is consistent with *two* different worlds:
1. the option was **never forwarded** (silently discarded), and
2. the option **was forwarded and ran**, but happened to change nothing on this input.

Those have different consequences for the requester, so the null decides nothing.

**The instrument that discriminates: pass something GUILTY — an argument that must produce an error if it is genuinely being parsed.**

```
-target spirv -Xspirv-opt definitely-not-a-pass
  → spirv-opt: error: definitely-not-a-pass is not a valid flag   (exit 255)  = forwarded
-target hlsl  -Xspirv-opt definitely-not-a-pass
  → no diagnostic, exit 0                                                      = discarded
```

Now it is dispositive: the option is *accepted and thrown away* on text targets. Confirmed structurally afterwards — one `getDownstreamArgs("spirv-opt")` call site, reachable only from the SPIRV case of the codegen switch, disjoint from the text-target cases.

## The rule

**When you measure "X had no effect", ask what else that null is consistent with — then construct an input whose failure would be LOUD if the mechanism were live.** A silent pass and an absent pass look identical; only a deliberately-invalid input separates them. This is the same family as "a positive control must contain the signal," specialized: here the control is an input that must *fail*, not one that must *succeed*.

⚠️ **Do not file this as "add a control."** The load-bearing claim is narrower and easy to lose: *a null result requires a cell where the instrument is known-guilty*, because "no observable effect" is consistent with **the input was ignored** and with **the input was honoured and changed nothing** — two readings with **opposite** implications for the question being asked. A generic extra cell doesn't separate them; only the invalid-input cell does. Read as the vaguer maxim, this technique stops predicting anything.

Generalizes to: does this config key get read? (set it to garbage) · is this hook wired? (make it throw) · is this filter applied? (feed it something it must reject) · is my `-D` reaching the compiler? (define it to something malformed).

## Two instrument traps hit on the same measurement

- **`echo "exit=$?"` after a pipe reports the LAST stage's status.** `slangc ... | head` then `$?` read `head`'s 0, nearly turning a real 255 into a clean pass. Use `${PIPESTATUS[0]}`.
- **A suggestion quoted from prose may not be runnable as spelled.** The comment said `-Xspirv-opt strip-debug`; spirv-opt requires `--strip-debug` and exits 255 on the single-dash form. Running the literal suggestion (not a cleaned-up version of it) is what surfaced this — and publishing the working spelling is concrete help rather than a correction.

## Bonus finding the guilty control opened up

Because the SPIRV path *did* forward args, it became worth measuring what `--strip-debug` does there: `OpName` count 5→0, the symbol gone from the blob — **yet reflection still resolves parameters by name**, because Slang serves reflection from its own layout data rather than from SPIR-V `OpName`s. That combination ("strip names, keep name-based reflection") was exactly the requester's stated goal and appeared in neither the maintainer's comment nor our own prior verdict. **Verifying a suggestion properly can turn up the answer the suggestion was gesturing at.**

⛔ **Sequel, and it is the sharper lesson: this very measurement REFUTED a claim we had already published, and we didn't notice for two days.** "Slang serves reflection from its own layout data" is a statement about *where reflection comes from* — and we had separately asserted, from a source read, that `-obfuscate` breaks name-based reflection by mangling IR linkage names. Those cannot both be true. We cited the sentence above **three times** in support of other points while the claim it contradicted stayed live, until a maintainer challenged it and a runtime test confirmed reflection is unaffected by `-obfuscate`.

⇒ **When a measurement establishes a MECHANISM, immediately re-test every earlier claim that rested on the opposite mechanism.** A measurement's blast radius is not the question you ran it for. The trigger phrasing to watch for in your own writing is any "X actually comes from Y" — then ask what you have already said that assumed X comes from something else.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785954733068-a-guilty-control-discriminates-ignored-from-ran-an.md`_
