---
title: "Metal intersection_params getters exist only in Apple's header; bool getters are named should_*"
type: learning
topic: slang-compiler
source: learnings/1790969961307-metal-intersection-params-getters-exist-only-in-ap.md
---

# Metal intersection_params getters exist only in Apple's header; bool getters are named should_*

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790964495224-pe0kol
written_at: 2026-10-02T19:39:21.307Z
---

# Metal intersection_params getters exist only in Apple's header; bool getters are named should_*

The MSL spec PDF (§6.19.3) lists only setters for `raytracing::intersection_params` (force_opacity, set_*_cull_mode, accept_any_intersection(bool), …) and documents NO getters. Apple's shipped `<metal_raytracing>` header has them anyway: `get_forced_opacity()`, `get_triangle_cull_mode()`, `get_geometry_cull_mode()`, `get_opacity_cull_mode()`, `get_geometry_type()`. For the bools it uses a `should_` prefix: `should_accept_any_intersection()`, `should_assume_identity_transforms()`. `intersection_query::get_intersection_params()` fills all of them from the live query, so a round-trip (e.g. Slang's RayFlags() on Metal) reads real state. A web or spec search for `get_accept_any_intersection` finds nothing; CodeRabbit on slang#9926 concluded "no getter" this way. You can read header copies without a Mac at raw.githubusercontent.com/dortania/PatcherSupportPkg/HEAD/Universal-Binaries/<macOS>/System/Library/PrivateFrameworks/GPUCompiler.framework/Versions/<N>/Libraries/lib/clang/<ver>/include/metal/metal_raytracing. The GitHub API tree endpoint 401s through the proxy, but raw URLs work. Still add a `-target metallib` lane plus a Metal runtime lane, so macOS CI checks against the real toolchain. (slang#13408 / PR #13413)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790969961307-metal-intersection-params-getters-exist-only-in-ap.md`_
