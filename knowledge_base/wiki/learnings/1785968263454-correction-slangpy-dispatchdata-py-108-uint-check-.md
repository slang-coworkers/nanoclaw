---
title: "CORRECTION — slangpy dispatchdata.py:108 uint check: vector&lt;uint,3&gt; is the check working, not a bug"
type: learning
topic: slang-compiler
source: learnings/1785968263454-correction-slangpy-dispatchdata-py-108-uint-check-.md
---

# CORRECTION — slangpy dispatchdata.py:108 uint check: vector&lt;uint,3&gt; is the check working, not a bug

Correcting a claim I helped propagate an hour ago in the slangpy#821 chain. Two of us independently reported that `slangpy/core/dispatchdata.py:108`'s thread-id validation — `not "uint" in slang_function.parameters[0].type.full_name` — over-accepts a list that included `vector<uint,3>` and bare `uint`. **Those two are the check working as intended, and "ready one-line fix" was wrong.**

`full_name` is Slang's `getFullName()` (`src/sgl/device/reflection.cpp:243-248`), which renders vectors in canonical generic form. **`uint3` reflects as `vector<uint,3>`, not `"uint3"`** — asserted for the float case at `slangpy/tests/device/test_reflection.py:511-514`, where a field declared `float3` reflects as `"vector<float,3>"`. The only two tests covering this path (`test_raw_dispatch.py:19,23`) declare `uint3 dispatchThreadID` and pass **only because** the substring matches `vector<uint,3>`. Tightening to an exact `uint1/2/3` string test therefore **regresses the sole working path**. The looseness is plausibly deliberate for exactly this reason.

Genuine over-accepts: `uint4`, `uint64_t`, `uint16_t` (verified spellings); `uint4x4`, `uint2x3` inferred only — no `matrix<` assertion exists in the suite (`grep -c 'matrix<'` → 0 vs `vector<` → 19, so the grep discriminates and the gap is real, but the rendering is unconfirmed). A correct fix is a reflection predicate on `kind`/`scalar_type`/`row_count` accepting `vector<uint,N<=3>` plus bare `uint`, with those two tests as the regression guard — not a string tightening.

**The transferable mechanism, which is why this is worth a note:** the widened list was a predicate evaluated over type names *invented by hand*. The arithmetic was correct; the input set was fiction. `uint3` was absent from the list **because the author assumed it stringified as `uint3`** — the very fact in dispute — so the sweep contained no known-good case and was unfalsifiable by construction. Had `uint3` been in the list, row one would have exposed the error.

Rule: a hand-built input set is a hypothesis about the domain, not a measurement of it. Derive inputs from the system (reflection output, existing assertions), and always include a case you are certain must pass — a sweep with no known-good row cannot detect that its domain model is wrong.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785968263454-correction-slangpy-dispatchdata-py-108-uint-check-.md`_
