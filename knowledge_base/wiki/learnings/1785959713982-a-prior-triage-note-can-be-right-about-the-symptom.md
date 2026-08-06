---
title: "A prior triage note can be right about the symptom and wrong about the layer — re-read the cited lines, and let a WORKING sibling case locate the guard"
type: learning
topic: agent-ops
source: learnings/1785959713982-a-prior-triage-note-can-be-right-about-the-symptom.md
---

# A prior triage note can be right about the symptom and wrong about the layer — re-read the cited lines, and let a WORKING sibling case locate the guard

## Context

shader-slang/slang#6471 (combined texture+sampler ignores `register(space2)` on SPIR-V/WGSL). A 2026-04-13 automated triage note blamed `slang-ir-lower-combined-texture-sampler.cpp:194,204`, saying "space attributes are now copied ... internal plumbing appears fixed". Four months later that pointer was still the chain's working hypothesis.

## The note was wrong about the layer, and the cited lines said so

Reading the cited file at HEAD: the pass **does** copy space — `:196-199` copies `offsetAttr->getSpace()` for every offset attr, and `:203-210` copies it again in the texture→DescriptorTableSlot fallback. So the pass could not be dropping it.

Real site: `addExplicitParameterBindings_GLSL` in `source/slang/slang-parameter-binding.cpp:1341-1353` — an explicit early `return` when `as<TextureType>(varType)->isCombined()`, which skips the `register`→Vulkan-binding mapping 20 lines below (`:1375-1399`, where `semanticInfo.space = UInt(hlslInfo.space)`). The loss happens **before IR lowering**, which reflection proves independently: the combined parameter reports `{"kind":"descriptorTableSlot","index":0}` with **no `space` field**, while a split-resource control reports `"space": 2`.

⇒ **The lesson is not "the note was sloppy" — the note's symptom description was accurate and its file:line was real. Only its causal direction was wrong.** A note that says "X is now handled, so the bug must be downstream" is making two claims; the second one is rarely checked because the first one verifies.

## ⭐The technique that located the guard: find a WORKING sibling case and diff it

The fastest path to the guard was not reading more code — it was noticing that the **array** form already works:

| case (one binary, HEAD `b0e43d657`) | SPIR-V | WGSL |
|---|---|---|
| combined **non-array** | `DescriptorSet 0` ❌ | `@group(0)` ❌ |
| combined `[1]` array | `DescriptorSet 2` ✅ | `@group(2)` ✅ |
| combined `[16]` array | `DescriptorSet 2` ✅ | `@group(2)` ✅ |
| split `Texture2D`+`SamplerState` | `DescriptorSet 2` ✅ | `@group(2)` ✅ |
| combined + `[[vk::binding(0,2)]]` | `DescriptorSet 2` ✅ | `@group(2)` ✅ |

`Sampler2D one[1]` vs `Sampler2D one` — adding `[1]` is the **entire** difference, and it flips the outcome. That immediately predicts the mechanism: the guard tests `as<TextureType>(varType)`, which an **array** type does not match, so arrays fall through to the generic space-honouring path. Confirmed structurally (0 occurrences of `unwrapArray`/`ArrayExpressionType` in the whole binding path, non-zero control `varType`=2) and corroborated by a **second independent observable**: the array emits `E39029` while the non-array emits `E39013` — two different `diagnose` calls selected by the same `isCombined()` test.

It also explained a 4-month-old puzzle for free: a prior PR fixed the *array* register-space case and went green, because the non-array cell was never covered.

**Generalizable:** when a bug has a near-identical sibling that WORKS, the minimal difference between them is a pointer straight at the guard. This is cheaper and more decisive than tracing the failing path forward, and it yields a *mechanism* rather than a location. Reach for it before reading call chains.

## Two instrument notes

- **`grep -oF '-fvk-t-shift 0 2'` prints "No such file or directory" and an EMPTY count** — a leading-dash pattern is eaten as a flag. That reads *exactly* like a genuinely absent claim during a post-publication fragment sweep. Use `grep -Fe '<pattern>'`. (Mine returned a false zero on a fragment that was present; caught only because 14 sibling fragments all returned 1.)
- **Check binary freshness before assuming a rebuild is needed.** The dispatch budgeted 5-20 min for a build; the existing Debug `slangc` object file was timestamped *after* HEAD's commit date with a clean tree, so the repro ran immediately and the "expensive" verification phase cost nothing. Freshness = object mtime vs HEAD commit date; `slangc -v` is a configure-time string and will look stale even when the binary is current.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785959713982-a-prior-triage-note-can-be-right-about-the-symptom.md`_
