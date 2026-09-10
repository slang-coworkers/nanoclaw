---
name: project_6471_combined_sampler_register_space
description: "slang#6471 — non-array combined texture+sampler ignores register(space) on SPIR-V/WGSL. Departure scrub for mkeshavaNV; root cause RELOCATED from the IR pass to slang-parameter-binding.cpp:1341-1353. Verdict posted, held on 2 maintainer design questions."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-05
---

# slang#6471 — combined texture+sampler ignores `register(space)` on SPIR-V/WGSL

**Chain: maintainer departure scrub, 2026-08-05. Verdict POSTED, no fixer dispatched.**

Filed 2025-02-26 by **TheSpydog** (external). `Sampler2D S : register(t0, space2) : register(s0, space2)`
emits `space0` / `@group(0)` for SPIR-V and WGSL; HLSL is correct. Labels `client support` +
`reproduced`, Type=Bug. **csyonghe (MEMBER) acknowledged it 2025-02-27** (cmt 2688752215): *"Yes,
this is something we need to fix."* ⇒ a maintainer-acknowledged gap, so staleness alone never
licensed a close.

Trigger: **jkiviluoto-nv** cmt `5195818494` (2026-08-05T18:40Z) — *"Mukund won't be returning to
this work for a while. Scrub … relevant, needs reassignment, or should be closed."*

## VERDICT: still relevant, needs a new owner. NOT a close.

Verdict comment **`5196636658`** — MINE-verified live: `nv-slang-bot[bot]`, 5,043 chars,
19:53:24Z, comments 6→7. Posted **fresh, not as an edit**, because the last commenter was the human
jkiviluoto-nv ⇒ a new comment notifies him (see [[feedback_an_in_place_edit_notifies_nobody]]).
Issue left **open**; assignee `mkeshavaNV` and the expired `Q4 2025 (Fall)` milestone **untouched —
recommend ≠ execute**, both are maintainer actions.

## ⭐ROOT CAUSE — relocated one layer up, and I verified it at source myself

The 2026-04-13 bot triage (cmt 4240355712) blamed
`slang-ir-lower-combined-texture-sampler.cpp:194,204`. **Wrong layer, and its own cited lines
disprove it** — MINE-VERIFIED at HEAD `b0e43d657` by reading the file: that pass *does* copy space,
`:196-199` (`info->space = offsetAttr->getSpace()`) plus the texture-offset→DescriptorTableSlot
fallback at `:203-210` (also copying space).

REAL SITE: `addExplicitParameterBindings_GLSL`, **`source/slang/slang-parameter-binding.cpp:1339-1353`**
— MINE-VERIFIED by `sed`, present at HEAD. ⚠️**APERTURE, not a discrepancy: the public comment cites
`:1341-1353`, this memo `:1339-1353`. BOTH CORRECT** — re-verified line by line: 1339-1340 are the two
rationale comment lines, 1341 is the first statement (`auto varType = …`), both ranges end at the same
closing brace. ⭐**Prefer the 1339 aperture when citing this for design question (a): that comment IS
the recorded intent** (*"We can't infer TextureSampler from HLSL (it's not an HLSL concept) / So use
default layout"*), which is what makes (a) a genuine design call rather than an oversight to patch. A
citation that starts at the first statement hides the rationale that settles whether this is a bug.
⇒ ⭐⭐**A line range is an ARGUMENT about scope, not just an address — and the triager was right to
check a near-miss rather than assume it benign, since its number is the one in a public comment.**

```cpp
// We can't infer TextureSampler from HLSL (it's not an HLSL concept)
// So use default layout
auto varType = getType(context->getASTBuilder(), varDecl.as<VarDeclBase>());
if (auto textureType = as<TextureType>(varType))
    if (textureType->isCombined())
    { ...maybeDiagnoseMissingVulkanLayoutModifier...; return; }
```

That early `return` skips the `register`→Vulkan mapping at `:1375-1399`
(`semanticInfo.space = UInt(hlslInfo.space)`). **The loss is UPSTREAM OF IR** — proven independently
by reflection: combined = `{"kind":"descriptorTableSlot","index":0}` with **no `space` field**;
split-resource control carries `"space": 2`.

⭐**Structural verification settles the DEFECT; it does NOT replace the execution.** The early
return is present in source at HEAD ⇒ the defect stands regardless of which binary emitted the
matrix, so lead with that rather than with binary provenance.

⛔**But my first framing of this was over-broad and the triager corrected it.** ⚠️**CREDIT SPLIT —
my first version of this line said "record the correction as yours, not mine" and the triager
refused it as over-assigned.** Verified against the message sequence: **it supplied the
COUNTEREXAMPLE** (*"the flip is not derivable from reading `:1341-1353`"*); **I supplied the FRAME**
(existence / observable / discovery as three questions, generalized past cost). ⇒ ⭐⭐**"Their
counterexample was right" and "they did the derivation" are two claims — and over-crediting a peer is
NOT the safe default, because it licenses trusting their framing later.** My habitual error is
over-claiming; this one ran the other way, so the lesson is *assign credit by what each side actually
produced*, not by which direction feels humble. I told it *"you don't need"* the binary claim. Wrong: the structural
read proves the early return **exists**; it produces neither the observable (`DescriptorSet 0`) nor —
decisively — the **array-vs-non-array flip**, and *the flip is what LOCATED the guard*. Reading
`:1341-1353` cold gives you nothing; you have to already suspect that line. Had it dropped the
execution on my advice it would have lost the discriminator that explains #8856/#7246.
⇒ ⭐⭐**A structural check and an execution answer DIFFERENT questions — existence vs observable-and-
discovery. "You don't need the second" is the same cheap-direction over-reach as
[[feedback_a_cost_model_i_never_measured_is_a_premise_not_a_constraint]]: proposing to drop evidence
because a cheaper path looks sufficient.** Both errors of mine on this chain ran that direction.

Rather than drop it, the triager **upgraded the provenance from inference to measurement**: a
behavioral probe (HEAD postdates PR #12328 ⇒ semicolon-less `throw` must be rejected — it is, with a
**must-differ control** at 0 for the semicolon-terminated form), a strictly-increasing chain
(source 17:53:58 → `.o` 17:57:36 → `libslang-compiler.so` 17:59:16.494 → `slangc` 17:59:16.622), and
`HEAD == origin/master` after a fresh fetch, tree clean. **I verified its premise in my own clone:
`19d1d4065` (#12328's merge) IS an ancestor of `b0e43d657`, 4 commits back** ⇒ the probe's
precondition holds. `slangc -v` disagrees **by design** — a configure-time string baked 07-17, never
a freshness instrument. ⭐**That is the right response to "your evidence is weaker than you think":
strengthen the instrument, don't discard the claim.**

⭐Its published-artifact check is the one I'd have asked for: it swept cmt `5196636658` for every
provenance string (`mtime`/`17:56`/`17:59`/`object file`/`binary is at HEAD`/`freshness`) → **0 each,
non-zero control `:1341-1353` = 1** ⇒ the caution applied to its *report*, not the public text, so
nothing was owed on GitHub. See [[feedback_publish_a_claim_as_wide_as_your_evidence]].

## ⭐DISCRIMINATOR — the array form already works, and that's why #8856/#7246 landed green

| case | SPIR-V | WGSL |
|---|---|---|
| combined **non-array** (the bug) | `DescriptorSet 0` ❌ | `@group(0)` ❌ |
| combined `[1]` and `[16]` | `DescriptorSet 2` ✅ | `@group(2)` ✅ |
| split `Texture2D`+`SamplerState` (control) | `DescriptorSet 2` ✅ | `@group(2)` ✅ |
| combined + `[[vk::binding(0,2)]]` | `DescriptorSet 2` ✅ | `@group(2)` ✅ |

The guard tests `as<TextureType>(varType)` — an **array** type doesn't match, so arrays fall through
to the generic space-honouring path. `Sampler2D one[1]` vs non-array is the minimal-difference cell;
`[1]` is the entire difference. Corroborated by a *different* observable: array emits `E39029`,
non-array `E39013` (two `diagnose` calls, `:1117` vs `:1131`, selected by the same `isCombined()`
test). ⇒ **explains why PR #8856 / #7246 fixed the array case without touching this.**
`-fvk-t-shift 0 2` does **not** rescue it.

**Verified workaround for the OP** (works on all of SPIR-V/WGSL/HLSL from one declaration):
`[[vk::binding(0,2)]] Sampler2D S : register(t0, space2) : register(s0, space2);`

## Test gap — real, and the zeros are controlled
4 test files pair `Sampler*D` with `register(`; 6 `//TEST:` directives total, targets `hlsl`×3 /
`dxil`×1 / `metal`×2 ⇒ **zero spirv, zero wgsl**, and none pairs a **non-array** combined sampler
with an explicit space. Non-zero controls: `DescriptorSet` in 34 test files, `@group` in 7 ⇒ the
zeros are real absence, not a broken grep.

## HELD on 2 maintainer design questions — deliberately not decided
(a) Should a bare `register(tN, spaceM)` on a combined sampler infer a Vulkan set **at all**?
    `E39013` currently declines to infer, by design.
(b) If it should infer, does it follow the `-fvk-*-shift` rules like other kinds?

**RESUME:** jkiviluoto-nv or another maintainer answers (a)/(b), or says "make a PR" → release
`slang-fixer` for a **draft** PR scoped to the `:1341-1353` early return + a regression test
asserting `DescriptorSet`/`@group` for the **non-array** form on **both** `spirv` and `wgsl`.
`pr: non-breaking` likely, but inferring a set where `E39013` currently declines is arguably a
behavior change ⇒ surface as the open design point, don't assume the label.
⚠`extras/formatting.sh` cannot run in the triager's container (gersemi/clang-format/prettier/shfmt
absent) ⇒ the PR author must format. RE-OPEN only on a fresh substantive human comment.

Triager memo: `/workspace/inbox/a2a-1785959724969-ynltjy/triage-6471.md`. Probes:
`/workspace/agent/scratch-6471/` (triager's container, not mine — see
[[feedback_group_clone_is_shared_by_all_sibling_sessions]]).

## Chain hygiene note
Two dispatches to `slang-triager` died on `API Error: Request rejected (429)`; the second burned
~27 min and left **zero** artifact (verified against GitHub: `comments: 6`, `updated_at` unmoved).
The third succeeded. See [[feedback_a_cost_model_i_never_measured_is_a_premise_not_a_constraint]] —
my restructuring of that third dispatch rested on a build-cost figure I never measured, and the
build turned out to be unnecessary.
