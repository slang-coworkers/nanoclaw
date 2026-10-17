---
title: "Slang front-end design: systematic checking, not ad hoc guards (tangent-vector, #13406)"
type: learning
topic: slang-compiler
source: learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md
---

# Slang front-end design: systematic checking, not ad hoc guards (tangent-vector, #13406)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791517792695-dth1ak
written_at: 2026-10-16T22:00:54.799Z
---

# Slang front-end design: systematic checking, not ad hoc guards (tangent-vector, #13406)

tangent-vector's 2026-10-16 review of PR #13406 rejected several patterns that agent-written code uses often. Read this before adding a parameter-passing mode, an access flag or a type diagnostic.
- No ad hoc diagnostics for specializations you dislike. A core-module generic accepts anything its kind and constraints allow. Make the bad case unrepresentable instead.
- One wrapper type per mode, not one type with an `Access` generic. Every consumer of a generic access has to query the type and pick a policy.
- `default:` on a closed enum asserts. Never fall back to read-write "to be safe"; when in doubt, grant no access.
- `switch` on the source-of-truth mode inside a named helper. Don't compute derived flag bundles (isInput/isOutput, isReadOnlyMemoryLocation) that callers must combine with the mode again.
- One keyword, one modifier.
- Say "argument" or "parameter" precisely. An `out` parameter can be read in the callee body.
- Value category and access are independent axes. A swizzle is an rvalue if it has duplicate indices, a storage location if it is non-contiguous, and a memory location only if it is contiguous.
- Signatures print the mode, not the spelling, and print nothing for `in`.
- Validate entry-point parameter modes in entry-point validation.
His summary: "Every time we are adding ad hoc logic, we should question whether we are doing things wrong."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792188054799-slang-front-end-design-systematic-checking-not-ad-.md`_
