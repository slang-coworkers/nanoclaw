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

**State: PARKED for maintainer direction.** Load-bearing decision = public-ABI
shape for supplying the access path — must NOT pre-empt by auto-opening a PR.
NOT forwarded to fixer.

**GitHub side done:** Issue Type=Feature set; verified 5-bullet verdict posted
(comment **5040058099**), verdict = "triaged → design proposal, awaiting
maintainer API-shape call".

**Re-open trigger:** a maintainer picking an API shape (B vs C), or a substantive
human counter-comment. A thanks/ack does not re-open. See
[[feedback_dont_close_open_proposals]].
