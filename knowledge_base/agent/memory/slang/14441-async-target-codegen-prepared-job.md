---
type: chain
title: slang#14441 — async target codegen overlapping session-owner frontend work (prepared-compilation job API)
description: Maintainer (skallweitNV, MEMBER) filed 2026-11-10 16:04Z. Feature/RTG. TRIAGED 16:19Z feature/P2 (cmt 6772694452). PARKED on maintainer scope pick A/B/C (triager rec C then A); triager re-check t-529d77 11-17. No fixer. H1/H2 latent races: bounded TSan repro authorized 11-10.
tags: [feature-request, api, threading, parallel-backend, codegen, design]
---

# slang#14441: allow async target codegen while the session owner keeps working

**Filed** 2026-11-10 16:04Z by skallweitNV (MEMBER). No labels, no assignees (events API empty at 16:05Z),
0 comments. Memory grep for `14441` hit only commit hash `b5ff14441` (#14238/#14321 chains), so no prior chain.

**Ask.** A "prepared compilation" boundary: the owner thread prepares a fully linked component plus target
(layout, layout IR, module dependency set, options, source-location snapshot), and app-owned workers run
`job->compile()` while the owner keeps loading, reflecting, and linking. The author lists 5 shared-state blockers:
lazy `getOrCreateLayout`/`TargetRequest::getTypeLayout`, the `SourceManager` registry, the `parseTermString`
temporary source-manager swap, late layout/hash/downstream-lib reads, and shared services
(witness-table IDs, `getOrLoadSlangLLVM`, HostVM emit). Related: #10792 (parallel-backend base), #12472.

**Routing.** No rung-4 hold (not self-assigned). Main session `sess-1794326675092-skrnm0` dispatched the
triager on 11-10 ~16:06Z with `thread_id=gh-issue-shader-slang/slang-14441`. The issue is design-scale, so a
fixer chain needs the operator/maintainer decision on design and scope. It is not an auto-fix.

## Log
- 11-10 16:06Z — dispatched to slang-triager.
- 11-10 16:07Z — triager ack (msg 10): triaging, spot-checking blockers on master, no fixer. Verified live: Type=Feature, label `RTG`, still no assignees.
- 11-10 16:19Z — **TRIAGED** (triager msg 12, memo `/workspace/inbox/a2a-1794327609663-aa19eo/triage-14441.md`):
  feature-request/medium/P2, not a duplicate (#10792 is the base, #12472 separate, #13455 closed not_planned overlaps blocker 1).
  The 5 blockers were checked against master `4f66408b` and all hold (source reads only). GitHub comment
  6772694452 by nv-slang-bot (verified) asks maintainers to choose: A = prepare/compile API, B = widen the
  existing guarantee with locks, C = harden shared services first. Triager recommends C, then A. One-shot
  re-check t-529d77 on 11-17 is the triager's task, so Main cannot see it via `ncl tasks`.
- Side hypotheses, both reachable under TODAY's contract: **H1**, the DXC/FXC include handlers write the
  shared SourceManager from workers (`slang-include-system.cpp:149-163`); **H2**, `getOrLoadSlangLLVM`
  (`slang-global-session.cpp:1290`) checks and then loads with no lock. **Main decision 16:2xZ:** authorized
  a bounded TSan/stress repro, H2 first, H1 only if DXC is available locally. File what reproduces without
  asking (filing policy), start no fixer chain, report up.
- 11-10 16:23Z — triager ack (msg 16): TSan build in `build-tsan-14441`, time-box from 16:22Z (ends ~18:22Z). DXC present, so H1 will be tried after H2.
- 11-10 17:00Z — triager [Report] (seq 25, to Main `skrnm0`): **H1 and H2 both reproduced on `4f66408b` and filed as #14443 and #14444** (#14444 = H1, concurrent DXIL `getEntryPointCode()` crashing in shared `SourceManager`/`CacheFileSystem` via the DXC include handler, `Dictionary::add` assert). Both are Type=Bug + `reproduced`, unassigned, and say "Related: #14441". No fixer started. **Their `issue_opened` webhooks need no dispatch**: this chain owns them, and whether a fixer chain starts is Main `skrnm0`'s call (sess `lu8p9f` checked 14444 at 17:0xZ and dispatched nothing).
- 11-10 17:00Z — triager [Report] (msg 18): **H2 → #14443, H1 → #14444**, both reproduced, filed and verified live
  (bot author, `reproduced`, Type=Bug, no assignees). The repro took about 37 min and the TSan build dir was deleted.
  **Main decision:** the #14443 fixer starts now, through the triager on `gh-issue-shader-slang/slang-14443`;
  #14444 stays filed-only until the #14441 scope pick. Sibling Main sessions `…tgirtq`/`…lu8p9f` were minted for
  their issue_opened webhooks.
