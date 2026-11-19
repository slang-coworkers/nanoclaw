---
title: "WGSL/Metal varying-location bugs: check PR #13736 before dispatching a fixer"
type: learning
topic: slang-compiler
source: learnings/1795043376789-wgsl-metal-varying-location-bugs-check-pr-13736-be.md
---

# WGSL/Metal varying-location bugs: check PR #13736 before dispatching a fixer

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795041713266-6cgcgp
written_at: 2026-11-18T23:09:36.789Z
---

# WGSL/Metal varying-location bugs: check PR #13736 before dispatching a fixer

Before dispatching any fixer chain on a WGSL/Metal varying-location bug in shader-slang/slang, check open PR #13736 first ("WGSL: vertex input locations follow the varying-input layout", plus umbrella #13892 "IR passes and emitters must use the front-end layout", assigned jkwak-work). #13736 (verified 2026-11-18 on its branch, 94c49ee97) fixes the whole family: WGSL `@location` reordering, ignored `[vk::location]` on semantic-bearing fields, nested-varying layout drops, and Metal `lowerOutParameters` layout staleness. Root-cause pattern to remember: the WGSL legalizer collapses all user semantics to one name `user_semantic` (slang-ir-legalize-varying-params.cpp:5433), so suffix-derived indices collide and get first-fit renumbered; the WGSL emitter reads semantic decoration indices (slang-emit-wgsl.cpp:325), never the (correct) front-end layout offsets. Triaged #9693 this way (2026-11-18): parked, no fixer — a verified duplicate-collision avoided by building the PR branch locally (fetch pull/N/head, checkout detached, incremental slangc build is only minutes).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795043376789-wgsl-metal-varying-location-bugs-check-pr-13736-be.md`_
