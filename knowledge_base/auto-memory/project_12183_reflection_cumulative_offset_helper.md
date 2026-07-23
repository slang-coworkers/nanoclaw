---
name: project_12183_reflection_cumulative_offset_helper
description: "slang#12183 reflection cumulative-offset helper API request — PARKED for maintainer API-shape call"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7cc2fa61-054c-448c-bd36-e34a3662db67
---

# slang#12183 — Reflection API cumulative-offset helper (feature request)

External reporter **emackey** (assoc=NONE) asks to promote the reflection-api
*example's* cumulative-offset logic into the **public Reflection API**, so apps
don't copy-paste it and don't have to track future `ParameterCategory` enum
additions. Filed 2026-07-21.

**Verified @958620c16 (triager):** confirmed gap — `calculateCumulativeOffset` /
`AccessPath` / `deepestParameterBlock` exist ONLY in
`examples/reflection-api/main.cpp:808-939`; zero hits in `source/` or `include/`.
Reflection returns *relative* offsets by design. Related-but-distinct: **#9102**
(not a dup).

**Classification:** feature-request / API enhancement / low / reflection-API
(public API) / P3.

**Solution space (triager memo, 3 approaches):**
- (A) auto-walking method — HIGH risk, fights "offset is a path property" invariant
- (B) library-owned access-path/cursor object — MEDIUM
- (C) minimal free helper taking an app-supplied path array — LOW
Recommend **B or C**; both move the category rules + future-enum coverage into
the library (the reporter's actual pain).

**State: PARKED-with-advanced-state (maintainer engaged 2026-07-22).** Load-bearing
decision = public-ABI shape for supplying the access path — must NOT pre-empt by
auto-opening a PR. NOT forwarded to fixer.

**Maintainer input — comment 5041452186 by tangent-vector (MEMBER, core):**
Supportive of Slang providing this as a **header-only library**. Framed the design
as two orthogonal axes: (1) value-representation — fat cross-platform (one scalar
per `SlangParameterCategory`, size coupled to compiler version) vs. target-compact
(per-target, but API tries to stay target-agnostic); (2) computation/path-supply —
on-the-fly-from-a-stack-of-variable-layouts (≈ Approach C) vs. shader-cursor
(≈ Approach B, Falcor-style, but reflection API has rough edges here). Endorsed
"one or more" of these — **did NOT pick one or say "make a PR"** → not converged,
not a build directive.

**GitHub side:**
- comment **5040058099** — initial verified 5-bullet verdict ("triaged → design
  proposal, awaiting maintainer API-shape call"). Issue Type=Feature.
- comment **5041505838** — triager reply to tangent-vector: thanked him, reflected
  the two-axis framing, captured header-only direction (a header recompiles per
  consumer → de-risks the binary-ABI concern), and asked the prototype-trigger
  question (want us to prototype one specifically — on-the-fly-from-a-stack helper,
  or a shader-cursor first cut — else stay parked). No fabricated doc link.

**Forward trigger:** a maintainer picks a specific approach / asks for a prototype /
says "make a PR" → triager flags Main FIRST (commits an API shape), THEN dispatches
slang-fixer on the canonical thread. Plain thanks/ack does not re-open. See
[[feedback_dont_close_open_proposals]], [[feedback_reopen_not_release_parked_feature]].
