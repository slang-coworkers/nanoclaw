---
name: project_12051_descriptor_reuse_pinning
description: "#12051 re-use loaded descriptors — HELD, no PR, design-gated on maintainer API-surface call"
metadata: 
  node_type: memory
  type: project
  originSessionId: a4546982-e3c1-438d-9b81-9756edcca56a
---

**#12051 "Add a way to re-use loaded descriptors multiple times"** (shader-slang/slang, author maxime-modulopi). Feature request: `DescriptorHandle<T> → T` re-materializes at every use → redundant descriptor reload in hot loops (reporter saw 2.5% SSR/HiZ tracing win by pinning via `OpCopyObject` spirv_asm workaround).

**Root cause (triager, verified HEAD 4676e878e):** `shouldDuplicateInstAtUseSite` hard-clones `CastDescriptorHandleToResource` (slang-ir-util.cpp:2638) + ops not `hoistable` (slang-ir-insts.lua:2731) → no CSE/LICM dedup. NOT a dup of [[project_11568_descriptor_heap_direct_index]] (that's input syntax; this is codegen reuse).

**Classification:** Feature/enhancement, low sev, P3. Component: IR + SPIR-V emit + core-module. Type set to Feature on GitHub; verified verdict posted (issuecomment-4937951648).

**ANSWERED jkwak (07-10, issuecomment-4940241238) — all 3 asks verified empirically at slangc 2026.12.2-60-g33f9ed0ce ≈HEAD, fresh CREATE (jkwak was last commenter):**
1. **Repro delivered + reporter is RIGHT:** `DescriptorHandle<Texture2D>` sampled 3× in a loop → per-use conversion emits `ResourceDescriptorHeap[i]` **3× (one reload/use)**. Hoisting the conversion into a local outside the loop → emits **1×, reused**. ⇒ "store in a local" **already works on HLSL today**, no new pin() needed there. This CORRECTS our earlier imprecise "no value to pin on HLSL" note.
2. **#11798 does NOT close #12051 (jkwak's 1st-comment guess checked & refuted):** #11798 is the [[project_11568_descriptor_heap_direct_index]] INPUT-SYNTAX feature (adds UntypedResourceHandle→uint lowering; peephole only collapses the uint↔handle round-trip). Changes how you SPELL a heap index, NOT how many times the descriptor loads. Complementary; does NOT by itself remove per-use reload. **Do not assume #11798 resolves this.**
3. **#12027 IS linked (same phenomenon):** #12027's cited comment (4930059216) = SAME reload at the function-param boundary (textures passed as descriptor INDICES, re-fetched far side — historical driver workaround). #12051 is the loop-local version. jkwak's "drivers may be in a better place now" directly enables auto-reuse here.

**Next: jkwak's design call** among — (a) document the "hoist into a local" idiom (works today, zero code), (b) opt-in reuse builtin, (c) automatic loop-invariant-load reuse pass. Triager offered to prototype whichever; **no PR yet (his surface)**. Chain OPEN, awaiting jkwak direction. ready/merge operator-gated regardless.

**MAINTAINER DIRECT-MENTION (07-10, 2nd comment):** jkwak-work `@nv-slang-bot`-mentioned (issuecomment-4940204817): *"I am not clear on what the problem is. Please give me a simple repro shader... also wondering if this is related to the workaround Slang has to use"* → links [#12027 comment 4930059216]. Answered as above.

**MAINTAINER ENGAGED (07-10):** jkwak-work commented (issuecomment-4940194035) responding to the author's HLSL-path question: *"this will be possible with the following PR: [#11798]"* — i.e. he links the descriptor-reuse/pin capability to the existing direct-index `ResourceDescriptorHeap` redesign ([[project_11568_descriptor_heap_direct_index]], draft #11798, "lower to uint in legalization" per csyonghe invariant). STRONG signal the fix path may be #11798, NOT a separate `pin()` builtin. Triager to verify what #11798 actually delivers re: reuse/CSE-ability, fold it against its own in-flight emit-datapoint check, and respond on GitHub. Routed through triager on canonical thread.

**RE-OPENED (07-10 later):** author maxime-modulopi replied (issuecomment-4938420177) challenging the "HLSL: no value to pin" scope note — points out HLSL *can* store `ResourceDescriptorHeap[i]` in a variable, so asks why `pin()` couldn't use that for the HLSL path. Triager verified at HEAD 4676e878e: reporter largely right, note imprecise — HLSL lowers via `kIROp_LoadResourceDescriptorFromHeap` (NOT force-cloned `CastDescriptorHandleToResource`), resource types storable in Slang IR (`canInstBeStored`=true) → pin() meaningful **all-target**, not SPIR-V-only. Was pulling fixer for one emit datapoint (per-use re-emit vs DXC CSE) when jkwak comment landed.

**STATE (07-10): HELD — no PR, design-gated.** Fixer correctly declined to open a bot draft on a maintainer-owned public API surface (precedent: #12027/#11657/#11655 all closed-unmerged for same reason). Root cause confirmed at HEAD 4676e878e by both triage AND fixer. Verified: no PR, no remote branch refs #12051; issue OPEN. GitHub triage comment (issuecomment-4937951648) updated IN PLACE to held state = live footprint. **Re-engages ONLY on a maintainer/human comment** (webhook → new inbound) → fixer prototypes Approach A as a DRAFT PR.

**Minimal-path lead (fixer):** internal `__copyObject<T>` (hlsl.meta.slang:13923, `[require(spirv)]`, `OpCopyObject $v`) already does the reporter's trick — exposing it publicly may be most of Approach A. The "no `shouldDuplicateInstAtUseSite` change needed" part is fixer *inference* (labeled as such in the public comment), NOT IR-verified.

**Next human action:** maintainer (@csyonghe/@jkwak-work) design decision on: spelling (pin/loadOnce), host (method vs free fn), scope (SPIR-V/GLSL-only vs all-target — "load once" is meaningless on HLSL, which lowers to `ResourceDescriptorHeap[i]`), and whether to also auto-hoist (Approach B). Not a dup of [[project_11568_descriptor_heap_direct_index]] (that's input syntax; this is codegen reuse).

**Routing:** triager owns fixer edge (do NOT double-dispatch). Canonical thread `gh-issue-shader-slang/slang-12051`.
