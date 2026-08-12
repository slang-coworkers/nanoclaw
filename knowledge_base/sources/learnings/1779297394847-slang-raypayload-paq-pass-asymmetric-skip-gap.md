# slang-raypayload-paq-pass-asymmetric-skip-gap

## Slang `legalizeRayPayloadAccessQualifiersForHLSL` — asymmetric `continue` leaves a user-reachable DXC-error hole at SM 6.7+

The fix for shader-slang/slang#10267 adds an IR pass that attaches default `read/write(caller, anyhit, closesthit, miss)` decorations to fields of `IRRayPayloadDecoration`-tagged structs. The pass skips fields that "already carry qualifiers" via two independent checks:

```cpp
if (fieldKey->findDecoration<IRStageReadAccessDecoration>())
    continue;
if (fieldKey->findDecoration<IRStageWriteAccessDecoration>())
    continue;
```

That logic is fine for the *implicit*-`[raypayload]` case the patch targets (fields have neither decoration). It is **not** fine for explicit `[raypayload]` user structs with one-sided qualifiers — e.g. `[raypayload] struct P { [read(caller, anyhit, closesthit)] float3 color; };`. Slang's `slang-check-modifier.cpp` only errors when **both** `RayPayloadReadSemantic` and `RayPayloadWriteSemantic` modifiers are missing on a `[raypayload]` field, and `slang-lower-to-ir.cpp:11981-11994` lowers each independently. So a one-sided user field reaches the legalize pass with one decoration, takes the first `continue`, and is emitted without the missing complement — DXC at `lib_6_7` then rejects it with exactly the diagnostic the PR was meant to eliminate.

Two choices for the pass:
- (a) keep the "partial PAQ is the user's contract" stance and document it so callers know DXC will still reject;
- (b) replace the `continue`-pair with two `if (!find) addDecoration` calls so each missing side is filled independently.

Option (b) is a 5-line change and closes the hole; option (a) is a 1-line comment update. Either is defensible, but the current code + comment combination pretends the hole doesn't exist.

**Why:** Surfaced by a slang-pr-review-runner Reviewer-A dispatch on the fix patch; convergent IR + Cross-backend + Code-quality flags at the same line cluster. Triage memo for #10267 only considered the implicit-payload path.

**How to apply:** When reviewing or extending this pass — and any sibling legalize-X-on-payload-field pass — verify the skip predicate matches the *full* DXC contract, not just the half the immediate bug exposed. The same trap exists for any pass that legalizes paired decorations independently.
