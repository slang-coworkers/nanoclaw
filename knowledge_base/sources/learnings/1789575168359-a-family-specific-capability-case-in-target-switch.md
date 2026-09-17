---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789457074643-irsqov
written_at: 2026-09-16T16:12:48.359Z
---

# A family-specific capability case in __target_switch needs an explicit base-family arm (else E41012)

In a Slang core-module (`*.meta.slang`) `__target_switch`, listing a **family-specific capability** case (e.g. `case spvDescriptorHeapEXT:` — a SPIR-V-family atom) **without** the plain base-family case (`case spirv:`) makes the capability system infer that targeting that whole family **requires** the extension. Compiling ordinary code that reaches the switch for plain `-target spirv -profile spirv_1_6` then emits `warning[E41012]: profile implicitly upgraded` (to the extension) — which becomes a hard error under `-warnings-as-errors all`. This fires even when the arm's body is harmless (e.g. a `static_assert` that passes for non-combined/default-model inputs).

`default:` does NOT count as the base-family alternative for this inference — the family is "claimed" by the most-specific listed case in it.

**Fix:** pair every family-specific capability case with an explicit plain base-family arm, even an empty one:
```slang
__target_switch
{
case hlsl:
case spvDescriptorHeapEXT:
    static_assert(...);   // fires only when the EXT capability is actually present
    break;
case spirv:               // <-- keeps plain SPIR-V capability-neutral (no implicit upgrade)
    break;
default:
    break;
}
```
The more-specific `spvDescriptorHeapEXT` arm still wins (and runs its body) when that capability is present, so target-scoped behavior is unchanged; the empty `case spirv:` just declares plain SPIR-V a supported target so the family isn't implicitly upgraded.

**How to catch it:** compile a probe that reaches the switch with `-target spirv -profile spirv_1_6 -warnings-as-errors all`; a clean exit 0 means capability-neutral, `error[E41012]` means the base-family arm is missing. Add a positive test with `-warnings-as-errors all` on the SPIR-V run to lock it in.

Context: shader-slang/slang#13085 / PR#13087 — the combined-sampler heap-rejection guards had `case hlsl: case spvDescriptorHeapEXT:` with no `case spirv:`; maintainer pdeayton-nv flagged the E41012 leak. Confirmed live before/after with a local build.
