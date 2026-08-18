---
title: "vk::location-on-non-varying warning (#6216): the param-binding gate placement and the 'double-emission matches precedent' trap"
type: learning
topic: agent-ops
source: learnings/1782225149459-vk-location-on-non-varying-warning-6216-the-param-.md
---

# vk::location-on-non-varying warning (#6216): the param-binding gate placement and the "double-emission matches precedent" trap

Reviewing shader-slang/slang#11705 (the #6216 "warn on `[[vk::location]]` on a cbuffer/resource" fix) surfaced two non-obvious facts worth carrying into any future review touching `addExplicitParameterBindings_GLSL`:

**1. Target-scope gotcha — the new warning is NOT Vulkan/GLSL-only.** In `source/slang/slang-parameter-binding.cpp`, `addExplicitParameterBindings_GLSL` has an early-return gate (~line 1143-1145) that returns only if the target is `!isKhronosTarget && !isWGPUTarget && !isMetalTarget` — i.e. it **admits Khronos OR WGPU OR Metal**. The descriptor-binding handling further down (~line 1184) is gated `isKhronosTarget || isWGPUTarget` (Metal excluded). PR #11705 inserted its `[[vk::location]]`-misuse warning at ~line 1175 — *between* the two gates — so the warning fires on Metal and WGSL too, emitting Vulkan-specific `[[vk::binding]]` advice, even though the PR/test framed it as "target-independent across the Vulkan/GLSL family." Lesson: when adding a diagnostic in this function, decide explicitly which of the two gates you want to sit behind; the early-return is broader (incl. Metal) than the binding-consumption gate.

**2. "Reported twice ⇒ matches sibling precedent" is a false justification.** The PR claimed the warning prints twice for an entry-point compile (global scope + entry-point program layout passes) "matching sibling parameter-binding warnings such as W39029." Verified false: the real sibling test `tests/diagnostics/vk-bindings.slang` annotates its `E39029` warning **once** under the same `-entry main -target spirv` exhaustive setup. The doubling is NOT a general property of these warnings — it happens only when the global parameter is **referenced** by `main()` (pulled into the entry-point program's layout pass); `vk-bindings.slang`'s global is unused by an empty `main()`, so it lays out once. Also: the test comment cited a diagnostic named `register-without-vulkan-binding` which **does not exist** (real name `register-modifier-but-no-vk-binding-nor-shift`, code 39029). When a PR justifies a hard-coded emission count by precedent, check the cited sibling test's actual annotation count — don't trust the prose.

Both points were independently flagged by the correctness reviewer (A) and the clarity reviewer (C); Devin (B) found nothing and merely echoed the PR body's (incorrect) precedent claim — a reminder that Devin tends to restate the PR description rather than independently verify count/precedent claims.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782225149459-vk-location-on-non-varying-warning-6216-the-param-.md`_
