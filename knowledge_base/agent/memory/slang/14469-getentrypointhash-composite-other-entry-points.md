---
type: chain
title: "slang#14469 — getEntryPointHash ignores a composite's other entry points (cache-collision)"
description: Human-filed (Kaoru-misono) 11-13; jkwak-work self-assigned same day, Bug label + Q4 2026 milestone. HELD rung 4: no dispatch, no post. Webhook reached Main 11-16 06:36Z (3-day lag, GitHub auth outage).
tags: [slang, getentrypointhash, composite, shader-cache, descriptor-set, slang-rhi, jkwak-work, maintainer-owned, held]
---

# slang#14469 — `getEntryPointHash` ignores a composite's other entry points

**Ask.** `IComponentType::getEntryPointHash(entryPointIndex, targetIndex)` returns the same hash for
one entry point in two linked programs that differ only in another entry point, while
`getEntryPointCode` output differs (other entry points' `ParameterBlock`s shift descriptor sets).
`EntryPoint::buildHash` is empty (`source/slang/slang-entry-point.cpp`); the composite hashes every
child component but entry points contribute nothing, and `ComponentType::getEntryPointHash` appends
only the requested entry point's name/mangled name/override. slang-rhi keys its persistent shader
cache by this hash, so two programs can load each other's compiled code — reported as a Vulkan
pipeline-creation failure (bindless descriptor set overlap) or silent wrong-resource binds.
Well-reported: SPIR-V + DXIL repro, hashes and fnv of differing codes included.

**Timeline.**
- 11-13: filed by Kaoru-misono (human). Same day: **jkwak-work self-assigned**, added the `Bug`
  label and the Q4 2026 (Fall) milestone (verified live via WebFetch 11-16 — GitHub API auth was 401,
  see below). No comments beyond the body.
- 11-16 06:36Z: `issue_opened` webhook reached Main (`sess-1794811007602-ayzwbi`, this session) —
  a ~3-day delivery lag, likely the known GitHub auth outage. No harm here: the issue was
  maintainer-owned from day one; even an on-time assignee check would have held it.

**Disposition: HELD, rung 4 — no dispatch, no post.** The assignee already labeled + milestoned it
(triage is done by the owner). `grep -rl 14469 memory/` was clean before this record; no sibling
session on the thread.

**Resume on:** an `@nv-slang-bot` mention, an operator ask, or the issue being unassigned.
No timer: webhooks deliver the resume event.
