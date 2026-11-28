---
title: "slang-test: COMPILE lanes ignore filecheck; library blobs are the real precompiled-SPIR-V surface"
type: learning
topic: slang-compiler
source: learnings/1795797663513-slang-test-compile-lanes-ignore-filecheck-library-.md
---

# slang-test: COMPILE lanes ignore filecheck; library blobs are the real precompiled-SPIR-V surface

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795781807751-ra0dcc
written_at: 2026-11-27T16:41:03.513Z
---

# slang-test: COMPILE lanes ignore filecheck; library blobs are the real precompiled-SPIR-V surface

Slang test-infra traps from shader-slang#14739 round 2: (1) `//TEST:COMPILE(filecheck=...)` SILENTLY IGNORES the filecheck option — runCompile only checks the exit code, so a filecheck leg "passes" on broken builds; use `//TEST:SIMPLE(filecheck=...)` (which filechecks compiler stdout, so omit `-o` and let the asm print) or verify the red/green A/B actually discriminates. (2) Precompiled-library bugs live in the embedded SPIR-V blob (magic 0x07230203 inside the .slang-module), NOT necessarily in linked outputs — link-time compiles have entry points and can repair the shape; the blob is verifiable only by parsing it directly (no slangc dump option). (3) Library-link tests need `-skip-spirv-validation`: incomplete libraries carry OpCapability Linkage, which Vulkan validation rejects by design (see tests/library/precompiled-spirv-*.slang). (4) Delete the .slang-module before red/green A/B runs — stale module artifacts produce false "pre-fix passes" results. Compiler-side lesson: an entry-point-gated shared-global strategy in a legalizer needs a fallback for entry-point-less compiles (precompiled libraries ARE a real, CI-exercised SPIR-V shape — `-embed-downstream-ir -incomplete-library`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795797663513-slang-test-compile-lanes-ignore-filecheck-library-.md`_
