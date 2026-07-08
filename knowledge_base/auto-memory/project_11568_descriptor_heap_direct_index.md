---
name: project_11568_descriptor_heap_direct_index
metadata: 
  node_type: memory
  type: project
  originSessionId: 5324107a-53f8-4242-9a16-17fbfc0a8f64
---

jkwak-work asked the bot (webhook, 2026-06-27) to base a PR on #11723 (which closed #11718). Triager correctly **redirected** — #11723 is backend SPIR-V stride only (emit-spirv/options/diagnostics/slang.h enum/docs), zero shared surface with #11568's front-end need. jkwak accepted the redirect (cmt 4819867103, "proceed with what Yong suggested").

Real blocker: generic `__subscript(uint) -> DescriptorHandle<T>` is uninferable (E39999) — OverloadResolveContext has no expectedType (slang-check-overload.cpp:3082). Implemented **csyonghe's settled design**: new builtins `UntypedResourceHandle`/`UntypedSamplerHandle` returned non-generically + implicit conversions reusing `kIROp_CastDescriptorHandleToResource`. Scope MEDIUM.

Draft PR **#11798** `Closes #11568`. 3 bot review rounds clean (REQUEST_CHANGES → APPROVE_WITH_NITS → APPROVE, 0 correctness bugs); codex caught+fixed a real Metal guard-bypass on Family-1 texture conversion (added `[require(glsl_hlsl_spirv_wgsl, descriptor_handle)]` on all 4 conversions). Tests 60/60 (HLSL/SPIR-V/GLSL/WGSL positive; E30019 heap-family-mismatch; E36107 Metal guard). Rebased onto master 33f9ed0cea (head 09ad277d1a) 2026-07-08, now MERGEABLE (was CONFLICTING); conflict resolutions append-only (stable-names 891–896, k_maxSupportedModuleVersion→25), feature diff unchanged.

**Only open gate = MAINTAINER-owned:** API-naming call (public `UntypedResourceHandle`/`UntypedSamplerHandle` vs `__`-prefix) + merge. Ready-flip/merge stays operator-gated. Fixer idle + webhook-driven; PR follow-up routes to slang-fixer as PR owner. Issue verdict at cmt 4819877983.

**Fleet-disk (2026-07-08):** fixer's /dev/vdb ~98–100% full (sibling wt-* build dirs ~85G); authorized standing reap of MERGED-worktree build dirs per [[feedback_always_reap_merged_worktrees]]. See [[project_fleet_build_thundering_herd]]. Escalate disk expansion to operator only if merged-reap is insufficient.
