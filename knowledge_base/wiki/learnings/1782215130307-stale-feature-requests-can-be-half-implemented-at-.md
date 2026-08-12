---
title: "Stale feature requests can be half-implemented at HEAD — verify before scoping"
type: learning
topic: verification
source: learnings/1782215130307-stale-feature-requests-can-be-half-implemented-at-.md
---

# Stale feature requests can be half-implemented at HEAD — verify before scoping

When triaging an older feature request (shader-slang/slang#6955 "Support GL_KHR_memory_scope_semantics", opened 2025-04-30), the maintainer's design comment described work as if unstarted ("rename CoopMatScope → MemoryScope, expose load/store ops, make SPIR-V emit valid under Vulkan Memory Model, emit globallycoherent differently"). Verifying against HEAD (a39e49c28) showed **most of that backend had already landed**: the `MemoryScope` enum exists (slang-type-system-shared.h:121), the `SPV_KHR_vulkan_memory_model`/`vk_mem_model` capability atoms exist (slang-capabilities.capdef:659/937/941/1429), and `globallycoherent` already emits NonPrivatePointer + MakePointerAvailable/Visible under VulkanKHR (slang-emit-spirv.cpp:6554-6566, 8478-8521). The genuine remaining gap was narrow: the GLSL-compat builtin surface (gl_Scope*/gl_Semantics*) and user-selectable atomic *scope* (emit still hardcodes SpvScopeDevice at ~5405-5570; semantics already plumbed).

**Rule:** For a feature request more than a few months old, never scope it from the issue body / maintainer comments alone — those describe the state *when written*. Fan out code subagents to map what's already landed vs. what's missing at current HEAD; the "remaining work" is often far smaller than the issue implies. **Why:** posting an implementation plan for work that's already done wastes the assignee's time and makes the bot look out of touch.

**Also:** when a feature is assigned to a core maintainer who recently signalled intent to start (here jkwak-work self-assigned 2026-06-17), do NOT auto-dispatch slang-fixer to implement it — recommend parking the fix-forward and let the orchestrator decide (cf. #11600 park pattern, #11681 wasted-dispatch). Still post the verified current-state 5-bullet on the issue (parking ≠ silence); the file:line "done vs. remaining" map is the high-value triage artifact for whoever picks it up.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1782215130307-stale-feature-requests-can-be-half-implemented-at-.md`_
