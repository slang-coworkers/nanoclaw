---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787791980479-g8j6x2
written_at: 2026-08-27T01:08:18.173Z
---

# [approver/challenger-miss] Devin 🔴 on a target-neutral core-module conversion is an OPEN_GAP abstain, not a BLOCK, when only one backend lowers it

**Symptom:** A fallback-tier (Devin-only) review flags a 🔴 "conversion enabled on unhandled backends" on a core-module `hlsl.meta.slang` change. Step 2's rule "any 🔴 Bug ⇒ BLOCK" tempts an automatic BLOCK.

**Root cause / correct classification:** slang#12681 added an `__IDynamicResourceCastable` conformance on `__SubpassImpl` mirroring the `_Texture` heap-cast pattern (`hlsl.meta.slang:27364` vs `:27396`). The conformance is **target-neutral** — no target gate — so `SubpassInput x = ResourceDescriptorHeap[i]` type-checks on *every* descriptor-heap target (HLSL/D3D12 emit `SubpassInput` at `slang-emit-hlsl.cpp:397`), while only the SPIR-V emitter learned to lower the heap fetch (`slang-emit-spirv.cpp:7562`). The non-EXT VkMutable path routes `DescriptorKind.Texture`→SampledImage heap — an *unratified* input-attachment mapping. That is an **open design gap** (real cross-backend blast radius), NOT a *verified* miscompile on a supported path.

**How to catch it:** When a 🔴 targets a core-module conformance/conversion (not emit logic), ask: is this a demonstrated crash/wrong-codegen on a supported path (→ BLOCK), or "this enables something whose lowering/semantics on other backends is undecided" (→ ABSTAIN OPEN_GAP)? A `hlsl.meta.slang` extension with no target gate has target-neutral reach by construction — grep the other emitters for the type to see who actually lowers it. Reinforced by the standing rule: a fallback-tier verdict you're unsure of routes to ABSTAIN, never rounds to BLOCK *or* APPROVE.

**Strong corroborating signal here:** the PR self-declared "[DRAFT — design unconfirmed]" with TWO UNCONFIRMED public-API design calls (reuse `DescriptorKind.Texture` vs new `InputAttachment` atom; sanctioned descriptor-heap path) posted to the maintainer, and "Do not merge until settled." A human shepherd (jkwak-work) was already reviewing (COMMENTED). Class lesson: **a target-neutral core-module change that only one backend lowers, plus author-flagged unratified semantics, is the OPEN_GAP shape — abstain to the human who owns the design authority, don't manufacture a BLOCK from a design 🔴.**

**Fix / procedure:** decision = ABSTAIN_POLICY, reason_code = OPEN_GAP. Not critique-gated. Recorded slang#12681@25ca1f53e035, mode live_late.
