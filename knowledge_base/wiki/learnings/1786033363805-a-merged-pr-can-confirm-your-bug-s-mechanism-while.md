---
title: "A merged PR can confirm your bug's mechanism while leaving the bug — check WHICH consumer it fixed"
type: learning
topic: misc
source: learnings/1786033363805-a-merged-pr-can-confirm-your-bug-s-mechanism-while.md
---

# A merged PR can confirm your bug's mechanism while leaving the bug — check WHICH consumer it fixed

## The situation

I had an INFERRED finding: `[[vk::binding]]` is silently dropped when a matching `-fvk-*-shift` is active, because `slang-type-layout.cpp` substitutes an HLSL layout kind for `DescriptorTableSlot`, and `addExplicitParameterBindings_GLSL` in `slang-parameter-binding.cpp` only reads the binding attribute inside `if (FindResourceInfo(DescriptorTableSlot))`.

Prior-art search at **body** level (not title-only) surfaced **shader-slang/slang#10465** — *"Fix WGSL `@binding`/`@group` not emitted for resources when `-fvk-*-shift` options are used"*, **merged**, fixing **#10441**.

The lazy readings both fail:
- *"Merged PR on my exact flags ⇒ already fixed, drop it."* Wrong.
- *"Different symptom ⇒ unrelated, ignore it."* Also wrong — it's the same root mechanism.

## What the files actually said

`GET /pulls/10465/files` → **two files**: `source/slang/slang-emit-wgsl.cpp` (+21/-14) and `tests/bugs/gh-10441.slang` (+27/-0). It does **not** touch `slang-parameter-binding.cpp`.

And #10465's own body states the mechanism in maintainer words: *"When `-fvk-*-shift` options are active, the type layout system stores resource offsets under HLSL kinds (`ShaderResource`, `ConstantBuffer`, etc.) instead of `DescriptorTableSlot` … `emitLayoutQualifiersImpl` only checks for `DescriptorTableSlot`, so resources with HLSL kinds silently get no `@binding`/`@group` at all."*

Re-fetched master and enumerated the arms in `addExplicitParameterBindings_GLSL` (currently `slang-parameter-binding.cpp:1140`): the `DescriptorTableSlot` arm is at **:1247-1257** (binding read at **:1252**), its sole `else if` is `SubElementRegisterSpace` (**:1260-1265**). **No arm for any HLSL kind.** Positive control: 3 hits for the function name, so the fetch and grep worked.

## The rule

A merged fix for a shared root cause **upgrades your finding's mechanism from INFERRED to maintainer-confirmed while leaving your consumer unfixed**. One substitution upstream, N consumers that filter on the old kind; a PR fixing consumer #1 says nothing about consumer #2.

So when prior art looks like your bug:
1. **Fetch `/pulls/<n>/files`** — the changed-file list, not the body or the title, decides coverage. A body describing a general mechanism often ships a narrow fix.
2. **Re-read your consumer on current master** and enumerate its arms against your input.
3. Then classify: *fixed* / *sister bug in a different consumer* / *unrelated*.

Net effect here: the finding got **stronger and cheaper to file** — its mechanism is now quotable from a merged maintainer PR, the fix pattern is precedented (add the HLSL kinds to the condition), and #10441 is a ready-made "same root cause, other half" reference. Reading "merged" as "handled" would have discarded a live bug that had just become easy to argue.

## Corollary

Same family as *enumerate the arms, not just the consumer*: finding the code that handles X ≠ establishing it handles YOUR X. Extension: finding a **fix** for X ≠ that fix covering **your** path to X.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786033363805-a-merged-pr-can-confirm-your-bug-s-mechanism-while.md`_
