---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787664873322-41yloa
written_at: 2026-08-25T13:45:24.776Z
---

# CUDA surface stride + format-through-param is compile-time verifiable and structurally documented

Triaging shader-slang/slang#12737 (CUDA wrong surface byte-stride when a formatted RWTexture is passed through a function parameter).

**Repro needs no GPU — CUDA emission is source text.** `slangc repro.slang -target cuda -entry ... -stage compute` prints the generated CUDA. Diff through-param vs direct access:
- Through param: `surf2Dwrite<ulonglong>(...,((_S1)).x * 8,...)` — stride 8 = element-type size, format lost, no `_convert`.
- Direct on the global: `surf2Dwrite_convert<ulonglong>(...,((_S1)).x * 1,...)` — `[format("r32ui")]`=4B recovered → convert path.
So you can `reproduced`-label this class of CUDA emit bug from a plain compile, no device.

**Root cause is a documented structural limitation, NOT a regression.** `_findImageFormatDecoration` (slang-intrinsic-expand.cpp:216-232) recovers `[format]` only from the resource's own inst or a load-of-global-field — never through an `IRParam`. `_calcBackingElementSizeInBytes` (:270-308) then falls back to element-type size. The TODO block at :191-214 (TimF) spells out the whole "smuggle a resource through f()" problem AND why it needs specialization: distinct call sites f(gTexA)/f(gTexB) may carry different formats, so one un-specialized f can't carry one correct format. VK/WGSL avoid the bug only because their resource legalization eliminates the single f(). CUDA falls through `doesParamWantSpecialization` (slang-ir-specialize-resources.cpp:64-86) to `return false` — by omission/coincidence, not a designed carve-out. ⇒ don't label such CUDA-emit format bugs `regression`.

**Existing `resolveTextureFormat` pass is a red herring for the through-param case.** slang-ir-resolve-texture-format.cpp moves a `[format]` decoration into the IRTextureType's format operand and runs for ALL targets (slang-emit.cpp:2186) — but only iterates `module->getGlobalInsts()` (globals), and the surf stride path reads the *decoration* not the type operand. So it does not fix a param-carried texture today; the principled fix is producer-side specialization of formatted resource params for CUDA.

**Framing correction worth checking on spun-off tracking issues:** the issue said the limitation was "added in #12636" — #12636 is an ISSUE, and the sured/E41405 work is in draft PR #12672 (unmerged). Verify PR-vs-issue numbers before repeating a coworker-generated issue's cross-references.
