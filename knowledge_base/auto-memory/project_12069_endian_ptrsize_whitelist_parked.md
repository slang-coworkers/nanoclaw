---
name: project_12069_endian_ptrsize_whitelist_parked
description: "#12069 endian/ptr-size arch whitelist in slang.h — MAINTAINER GO (jkwak-work), draft PR authorized, hybrid B-then-A"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4efe7a21-a5cf-46a2-a2c8-99441bda6fe2
---

shader-slang/slang **#12069** (ilyakurdyukov, external) — "Stop determining byte order and pointer size from architecture whitelists." Config block in `include/slang.h` (ptr `466-469`, endianness `471-493`, guard `511-514`). Verified at HEAD `8f0c3515d`.

**Disposition (2026-07-15): MAINTAINER GO — draft PR authorized.** jkwak-work (core maintainer) commented on the issue (cmt 4984853208): "please make a PR as suggested." Released the park; re-dispatched fixer THROUGH slang-triager for the hybrid B-then-A **DRAFT** PR. Stays DRAFT — maintainer authorizing the PR ≠ flip-to-ready; no ready/merge without a further explicit go. Real `@nv-slang-bot` mention → github-post-authorized.

Prior state: triaged/parked drafts-only. Classification bug (latent portability)/low/**P3**/core–public-ABI-header.

3 claims all VERIFIED by slang-triager:
1. gcc+clang predefine `__BYTE_ORDER__`/`__ORDER_LITTLE_ENDIAN__`, `__SIZEOF_POINTER__`, `__LP64__`/`_LP64` (`__POINTER_WIDTH__` is **clang-only**; **MSVC provides none** → needs `_WIN64` special-case).
2. (narrow) endianness `#error` uses `|` so fires only when *neither* flag set; internal if/elif+`#ifndef` chain can't set both → both-set reachable only via user `-D`/`SLANG_USER_CONFIG`.
3. (**load-bearing**) unlisted 64-bit arch (rv64/LoongArch64/s390x/MIPS64/SPARC64) → `SLANG_PTR_IS_32` silently =1 with NO guard → `SlangInt` flips 32-bit → public-ABI corruption. Asymmetric w/ endianness (which fails loud). **No supported target affected** (all shipped arches whitelisted correctly) — latent only, hence low sev, no `reproduced` label.

Block is single source of truth (copied verbatim into generated preludes). `SLANG_PROCESSOR_*` atoms consumed elsewhere (core.meta.slang intptr, nvrtc, slang-llvm) — must NOT remove atoms, only endian/ptr *derivation* in scope.

Recommended fix (held): **hybrid B-then-A** — (B) add symmetric pointer-size `#error` + both-set guard; (A) compiler-macro primary detection with whitelist retained as ABI-preserving fallback + `sizeof(void*)` cross-check. Approach C (rip out whitelist) = maintainer-reject risk.

GitHub verdict posted: comment **4950154455**, Issue Type=Bug. slang-triager owns fixer edge (peer-wired) — authorizations route THROUGH triager, don't double-dispatch fixer. Canonical thread `gh-issue-shader-slang/slang-12069`. **Re-engage on maintainer comment/PR**; fixer holds at DRAFT, never flips ready without explicit go. See [[feedback_drafts_only_guardrail]], [[feedback_route_authorizations_through_dispatch_owner]], [[feedback_no_double_dispatch_peer_wired]].
