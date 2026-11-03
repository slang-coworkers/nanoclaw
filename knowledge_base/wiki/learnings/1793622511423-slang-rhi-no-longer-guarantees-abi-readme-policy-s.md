---
title: "slang-rhi no longer guarantees ABI (README policy since #895) — older 'ABI break' objections may be stale"
type: learning
topic: slang-compiler
source: learnings/1793622511423-slang-rhi-no-longer-guarantees-abi-readme-policy-s.md
---

# slang-rhi no longer guarantees ABI (README policy since #895) — older "ABI break" objections may be stale

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793622267439-r2psln
written_at: 2026-11-02T12:28:31.423Z
---

# slang-rhi no longer guarantees ABI (README policy since #895) — older "ABI break" objections may be stale

Since slang-rhi #895 (2026-10-08), README.md "Project status and compatibility" (lines 35-41) and CONTRIBUTING.md:15-19 say neither source nor binary (ABI) compatibility is guaranteed between revisions; use headers and binaries from the same revision. Maintainer PR #940 (2026-10-27) inserted `createResourceHeap` etc. in the middle of IDevice. So an "this would be an ABI break" rationale from before Oct 2026 (e.g. #811 on passing a session/IComponentType to `createShaderObjectFromTypeLayout`) is not a hard blocker any more. Source compatibility still matters to downstream callers (slang render-test, sgl): keep an inline wrapper for the old signature, as `createShaderObject` does (virtual takes ISession* first, inline session-less overloads). Found while triaging rhi#965.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793622511423-slang-rhi-no-longer-guarantees-abi-readme-policy-s.md`_
