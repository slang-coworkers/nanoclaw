---
name: project_11938_pathinfo_leak_parked
description: "#11938 CacheFileSystem::PathInfo repro-load leak — PARKED behind author's own PR #11937; fixer NOT dispatched"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0b2a5c35-8dbb-491a-970d-181672b3439c
---

shader-slang/slang **#11938** — repro load leaks `CacheFileSystem::PathInfo` objects with empty unique identity. `ReproUtil::load` hand-off (`slang-repro.cpp:1157-1159`) `continue`s past empty-identity entries → owned by nobody → LSan direct 32-byte leak from `getPathInfoFromFile`.

**Triaged + verdict posted** (HEAD f4975a7f8, comment 4875647828, Type=Bug, low/P3/core). Root cause answers the TODO: empty-identity is an *intentional* shape (`StoreContext::addFile` for in-memory sources) → fixing the producer is the wrong layer. Fix = **Approach A**: give `CacheFileSystem` an owned `List<PathInfo*>` (freed in dtor/`clearCache`), register orphans instead of skipping, then drop the `LEAK: getPathInfoFromFile` accepted-findings line. Ready-for-fix, no maintainer design call. `reproduced` NOT applied (LSan not run locally, inspection-only).

**PARKED — fixer NOT dispatched.** Same author **jvepsalainen-nv** filed #11938 AND owns open **PR #11937** which *accepts* this leak (adds the `LEAK:` line referencing #11938) + fixes the adjacent SourceFile/preprocessor leaks — but does NOT fix #11938 itself. Author deliberately split this into its own tracking issue → owns the follow-up, which is stacked behind #11937 (must merge first, then remove the accepted line to avoid conflict). A competing bot draft would duplicate + conflict on the exact findings-file line.

**Re-engage only if:** a substantive author/maintainer webhook lands on #11938, OR #11937 merges and the follow-up stalls with no author movement. Do NOT auto-dispatch fixer on a bare comment — author owns this. Related: [[feedback_let_fixer_own_single_session]], [[feedback_reopen_not_release_parked_feature]].

**NOTE (self-correction, 2026-07-03):** No author reply has landed as of parking. An earlier draft of this note fabricated a jvepsalainen-nv comment (4875980012) + a loadFileSystem heads-up — that never happened; removed. Author-ownership inference is from PR #11937 existence, not a reply on #11938. The triager memo DID independently flag the sibling `loadFileSystem` skip path (`slang-repro.cpp:917-920`) as covered by Approach A — that part is real (from triage-11938.md), not from any author comment.
