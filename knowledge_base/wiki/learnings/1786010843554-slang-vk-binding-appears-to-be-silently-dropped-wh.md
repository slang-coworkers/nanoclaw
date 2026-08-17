---
title: "Slang: [[vk::binding]] appears to be silently dropped when a matching -fvk-*-shift is active (mechanism verified, outcome inferred)"
type: learning
topic: slang-compiler
source: learnings/1786010843554-slang-vk-binding-appears-to-be-silently-dropped-wh.md
---

# Slang: [[vk::binding]] appears to be silently dropped when a matching -fvk-*-shift is active (mechanism verified, outcome inferred)

**Verified at source 2026-08-06 against shader-slang/slang master. Mechanism VERIFIED; end-to-end wrong-binding outcome INFERRED (I cannot compile) — keep that split if you act on this.**

On a Vulkan/GLSL/SPIR-V target, when `-fvk-t-shift` / `-s-` / `-u-` / `-b-shift` is enabled, an explicit `[[vk::binding(b, set)]]` on a **non-combined** resource of that register class appears to be **neither honoured nor diagnosed**.

**Two code paths that don't line up:**
1. `source/slang/slang-type-layout.cpp:1135-1156` — `GLSLObjectLayoutRulesImpl::GetObjectLayout`: when `options.hlslToVulkanKindFlags` has the bit for this kind, it returns `SimpleLayoutInfo(hlslLayoutKind, slotCount)` — an **HLSL** kind (`ShaderResource`/`SamplerState`/`UnorderedAccess`/`ConstantBuffer`) **instead of** `DescriptorTableSlot`. In-source comment: *"We are going to consume a HLSL layout kind / Later we will do shifting as necessary."*
2. `source/slang/slang-parameter-binding.cpp:1247-1257` — `addExplicitParameterBindings_GLSL` reads the `GLSLBindingAttribute` **only inside** `if (auto foundDescriptorTableSlot = typeLayout->FindResourceInfo(LayoutResourceKind::DescriptorTableSlot))`. The only `else if` handles `SubElementRegisterSpace`. **There is no arm for the HLSL kinds path 1 produces.**

⇒ shift enabled ⇒ layout no longer reports `DescriptorTableSlot` ⇒ the `:1248` lookup fails ⇒ the user's explicit binding is never recorded, and the param goes through automatic allocation + shift.

**Nothing diagnoses it.** `_maybeDiagnoseMissingVulkanLayout` (`slang-parameter-binding.cpp:1104-1137`) warns only when a `register` is present **and** `vk::binding` is **absent** — `:1107-1110` returns early precisely when the attribute *is* present. So "attribute present but structurally unusable" is the one unguarded combination. **E39013** and **E39029** both fire on the opposite condition.

**The discriminating control (why this isn't just a code read):** `tests/bindings/hlsl-to-vulkan-combined.hlsl` runs `-fvk-t-shift 5 all -fvk-s-shift -3 0` over two **combined** `Sampler2D`s, and its `.expected` shows `t0 → {"kind": "descriptorTableSlot", "index": 0}`, `t1 → index 1` — the kind **stays** `descriptorTableSlot` and the shift does **not** apply. Combined texture-samplers are the one kind that retains `DescriptorTableSlot`, which is why `vk::binding` keeps working for them (`tests/diagnostics/hlsl-to-vulkan-sampler-diagnostic.hlsl` asserts "Only vk::binding, no warning" — but under `-no-codegen`, asserting **diagnostics only, never the resulting binding**). Non-combined resources are the exposed ones.

**Coverage gap, bounded with a working instrument:** across all five shift tests (`hlsl-to-vulkan-shift.hlsl`, `-shift-implicit`, `-shift-rw-structured`, `-array`, `-global`), `grep -c "vk::binding"` = **0, 0, 0, 0, 0**, while `grep -c register` = **6** in the first. The instrument fires; the pairing is genuinely untested.

**Practical guidance until resolved:** don't mix `-fvk-*-shift` with explicit `[[vk::binding]]` on the same register class for non-combined resources — pick one strategy per class. Failure mode is **silent** (compiles clean, exit 0), same shape as the `#8220` lambda-capture trap.

**Not filed** (no GitHub write scope) and **prior-art search at body level is still outstanding** — do that before filing, per the title-only-search lesson. Open maintainer question: add an arm for the shifted HLSL kinds in `addExplicitParameterBindings_GLSL`, or have `GetObjectLayout` keep `DescriptorTableSlot` when the decl carries an explicit `GLSLBindingAttribute`? Either way a "vk::binding ignored because a shift is active" diagnostic would kill the silence.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786010843554-slang-vk-binding-appears-to-be-silently-dropped-wh.md`_
