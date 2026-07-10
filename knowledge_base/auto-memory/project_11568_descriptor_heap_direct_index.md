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

**MAINTAINER REVIEW 2026-07-08:** jkwak ran a 9-comment review round (7 comment-trim in hlsl.meta.slang removing ad-hoc "Family-1/2" terminology — code byte-unchanged; 2 test-strengthening: `-target dxil` DXC-compile + GLSL via glslang `-emit-spirv-via-glsl`), then **"Looks good to me" + resolved all 9 threads**. Fixer fast-forwarded onto jkwak's own merge commit `1adba4cf8c` (did NOT force over it — merge preserved), head `5f4a206568`.

⚠️ **FIXER HARD-DOWN 2026-07-09 22:54Z (blocker, operator-owned).** Fixer session `sess-1781219496490-v720ku` (group ag-1780667166439-vmjrwe) died on autocompact thrash (~890K-token context, 3× refill). **BUT csyonghe's invariant edits are DONE on disk in wt-slang-11568** (seq 255 @ 18:51Z: lowerUntypedResourceHandleToUInt pass + 3 emit/layout asserts + AST comment + -O0 test; build was started). Thrash trigger = jkwak's 22:28Z "address Yong's comments" + thread-resolve webhooks refilling an already-huge context. Remaining work = verify-build → push → reply to csyonghe/jkwak threads (comment_ids: csyonghe r3553920251 + r3553924763; jkwak issue-cmt 4930113464). Restart ≠ fix (resume reloads bloated transcript → re-thrash); needs operator `/clear` on that session OR re-dispatch to a fresh session. ⚠️ Do NOT `ncl groups restart --id <fixer-group>` — group-scoped, would kill ~6 live sibling fixer sessions (#7406 awaiting-merge, #12032, #12004, #11954, #12029). NOTE: an accidental `restart help` misparse (07-10 01:30Z) bounced an orchestrator-group session (sess-1781218996321-ahx971), NOT the fixer — fixer still down. Escalated to operator.

**Design pivoted 2026-07-09 — park RELEASED on csyonghe directive.** The jkwak↔csyonghe discussion produced a concrete outcome: csyonghe (design author) gave an **invariant directive** — the untyped descriptor-heap handle must NEVER reach emit; lower it to `uint` in a legalization pass, and emit/layout sites become internal errors. This is a design shift from the original "handle rides existing DescriptorHandle<T> lowering through to emit" approach. Fixer is executing it (PR-owner webhook): new `lowerUntypedResourceHandleToUInt` pass + 3 emit/layout asserts + AST comment + -O0 regression test; rebuilding on branch fix/issue-11568 (worktree wt-slang-11568). Legitimate re-activation — a design-pivot directive is exactly the concrete signal the park was waiting for ([[feedback_reopen_not_release_parked_feature]]). Head still `5f4a206568` until this pass lands.

**Remaining gates (all external):** (1) jkwak↔csyonghe design discussion outcome; (2) `pull_request` CI green on `5f4a206568` — earlier run's 2 red jobs were GPU-`createComputePipeline` infra flake (text suite 5463/5463; master flips same jobs), fixer retried; (3) human merge. Ready-flip/merge stays operator-gated; fixer does not merge. Fixer idle + webhook-driven; PR follow-up routes to slang-fixer as PR owner. Issue verdict at cmt 4819877983.

Fleet-disk (which had blocked local compile-verify) is RESOLVED per [[project_fleet_disk_capacity_wall_11969]] — CI remained the build authority throughout regardless.
