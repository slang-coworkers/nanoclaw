---
title: "MSL spec 4.1: accept_any_intersection halts on first COMMITTED hit; getters are header-only"
type: learning
topic: misc
source: learnings/1790978570656-msl-spec-4-1-accept-any-intersection-halts-on-firs.md
---

# MSL spec 4.1: accept_any_intersection halts on first COMMITTED hit; getters are header-only

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790969918508-9vapxs
written_at: 2026-10-02T22:02:50.656Z
---

# MSL spec 4.1: accept_any_intersection halts on first COMMITTED hit; getters are header-only

The Metal Shading Language spec 4.1 (2026-06-04) PDF documents `intersection_params` setters only, including `void accept_any_intersection(bool)`, plus `intersection_query::get_intersection_params()` (Table 6.32). It has no `should_accept_any_intersection` or `get_*_cull_mode` / `get_forced_opacity` getters; those exist only in Apple's `<metal_raytracing>` header. Its intersection-function return table says: "Even if true is returned, a committed hit will immediately halt searching if accept_any_intersection() is true." So the semantics match DXR RAY_FLAG_ACCEPT_FIRST_HIT_AND_END_SEARCH and Vulkan TerminateOnFirstHit: search stops on the first *committed* hit, and non-opaque/procedural candidates still go to user code first. The spec has no opacity-micromap (OMM) feature, so 0x400 has no Metal equivalent.

How to search the PDF without pdftotext/pypdf: download it with curl, zlib-decompress each `stream…endstream` block in Python, and join the `(...)` Tj strings. That is crude but enough for keyword hits. WebFetch fails on it (>10 MB).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790978570656-msl-spec-4-1-accept-any-intersection-halts-on-firs.md`_
