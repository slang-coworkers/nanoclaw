---
type: chain
title: slang#14444 — concurrent getEntryPointCode() to DXIL crashes when DXC resolves #include via shared SourceManager / CacheFileSystem
description: Bot-filed (slang-triager) 2026-11-10 16:58Z as side-finding H1 of #14441. Owned by the #14441 triager chain, so do NOT dispatch its issue_opened webhook. FILED-ONLY; 11-17 HOLD — assigned to jkwak-work (11-11), fixer withheld to avoid colliding with in-house maintainer work; fix shape awaits the #14441 scope pick.
tags: [threading, dxil, dxc, source-manager, parallel-backend, race, tsan, split-out]
---

# slang#14444: DXIL include-resolution race on shared SourceManager / CacheFileSystem

⚠️ **Its `issue_opened` webhook belongs to the [#14441 chain](14441-async-target-codegen-prepared-job.md), so do not dispatch it.**
Filed by nv-slang-bot through slang-triager, labelled `reproduced`, Type=Bug, no assignees.

**Repro** (master `4f66408b`): 8 threads compile a coopvec shader that emits `#include "dx/linalg.h"`, using
`-Xdxc -I`. 8 of 40 release runs aborted on `slang-dictionary.h(325): The key already exists in Dictionary`;
with 1 thread, 0 of 40 failed. TSan shows `SourceManager::findSourceFile :968` racing `addSourceFile :1019`,
and `CacheFileSystem::_resolvePathCacheInfo :673` racing `:682`.

**Routing (Main 17:0xZ): FILED-ONLY, no fixer yet.** The fix shape is part of the #14441 scope decision
(option C step 1). It could be a synchronized append-only registry or a per-job source context for downstream
includes. The triager's #14441 re-check t-529d77 (11-17) covers it.

- 11-26 — **HOLD reconfirmed (Main, live-verified)** for the operator's triage request. Live state unchanged: open, `reproduced`, 0 comments, jkwak-work still the only assignee (11-11); #14441 still open with no maintainer scope direction since 11-10. Verdict delivered to the operator: subsystem compiler-core session-shared state (SourceManager/CacheFileSystem/include system via DXC callback), severity high (crash in documented multithreaded getEntryPointCode workflow), next step filed-only hold. No triage dispatch (own chain's Terminal filing, per the #14441 chain page).
- 11-17 — **HOLD confirmed (Main, live-verified).** jkwak-work (maintainer) assigned this issue 11-11 18:25Z and
  also took #14443 — the cluster is being worked in-house. Assignment ≠ the A/B/C scope pick, so no [Triage handoff];
  a fixer chain would collide with jkwak-work's own work. Trigger for handoff: written scope direction on #14441 or a
  maintainer ask for input. Final auto re-check `14441-scope-recheck-7120` fires 11-24 16:00Z; see the
  [#14441 chain page](14441-async-target-codegen-prepared-job.md).
