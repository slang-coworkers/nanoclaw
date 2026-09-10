---
name: project_12112_compile_perf_memory_tracking_parked
description: "#12112 compile-perf memory-footprint tracking — PARKED for assignee"
metadata: 
  node_type: memory
  type: project
  originSessionId: 07bc433b-4442-4b50-af76-27553cfb0f19
---

**#12112** — feature-request (tooling/perf-CI, not a compiler bug): track memory footprint (peak RSS per workload, session-create delta) alongside compile times in the compile-perf tracker.

Triaged 2026-07-15 (low/P3, CI-perf-tooling). Verdict posted → issue comment 4977423595.

**PARK RESOLVED via assignee's own PR #12125** (2026-07-15, comment 4984698044). jvepsalainen-nv implemented it themselves: collection works on all 3 platforms incl. Windows perf runner; api-driver reports first-session createGlobalSession RSS delta (~200 MiB, matching #9817/#12113); memory renders as line panels on memory-{tot,releases}.html, session floor = landing headline. Post-merge: one `force=true` release resync backfills 26 releases and puts the #12113 regression on public charts.

**APPROVER R1 2026-07-15: BLOCK (RED_BUG) @ 3304a7a64e29** (shadow-mode, ledger-only, NOT posted to GitHub). Production `github-actions[bot]` review = 🔴 "1 bug, 3 gaps, 2 questions". Challenger verified: `native/api-driver.cpp:56-58` includes `<psapi.h>` before `<windows.h>` with no earlier `windows.h` pull-in → `DWORD`/`HANDLE` undefined → `cl.exe` fails. CI-INVISIBLE (not in CMake; `bench.py:build_api_driver` compiles out-of-band via `cl.exe` on Windows perf runner).

**APPROVER R2 2026-07-15: ABSTAIN_POLICY (OPEN_GAP) @ 52343d438c79** — SUPERSEDES R1 BLOCK. Fresh clause eval + review input + challenger + own ledger row; nothing carried from R1. **The expected include-order fix did NOT land** — pushes since R1 (73fb60bf→52343d43) touched only `report.py` + `fetch_releases.py` (memory-page presentation + macOS zip symlinks); `native/api-driver.cpp` is **byte-identical to R1**, still psapi-before-windows. But verdict flipped BLOCK→ABSTAIN because the head-current production `github-actions[bot]` review now grades the SAME include-order issue as a **🟡 gap, not a 🔴 bug** ("5 gaps, 0 bugs"). No 🔴 = no BLOCK floor; approver refuses to self-manufacture one → held as OPEN_GAP for maintainer. Bug-vs-gap divergence on identical code = uncertainty → ABSTAIN, never rounded up. Two open gaps: (1) Windows build — include order + `psapi.lib` missing from `cl.exe` link (Devin still calls it a Bug; approver verified the break); (2) unreachable memory-trend alert `trend.py:172-173` — `timers_for` filters out `*Kb` counters, defeating the PR's core regression-tracking purpose. **PROCESS NOTE:** R2 first harvest raced ~2 min ahead of head-current production review, fell to CodeRabbit fallback, re-derived BLOCK off Devin's Bug signal — OUTPUT_REVIEW critique gate caught it, forced re-harvest → correct ABSTAIN. Learning: re-harvest synchronize revisions; production review can post minutes after your harvest and flip the tier.

Chain now = **maintainer's call on the two OPEN_GAPs** (jvepsalainen-nv's own PR on own tooling). Both gaps are publicly flagged on the PR by the production bot review, so author sees them without us posting. NOT await-merge, NOT a BLOCK. Await author's next push (fix or intentional merge-through).

**Design-settled note** (2026-07-15, issue comment 4985487696, #12125 commit **2edd1c4ba** — NEWER than approver R2 head 52343d43, so next #12125 synchronize re-harvests): "store everything, show only what is meaningful." Raw peak RSS recorded in results.json for every workload; promotion into tracked series / trend-alerts / memory-pages gated on a manifest `track_memory` flag carried by exactly 3 series — `minimal` (session floor; caught the v2026.7 doubling AND a previously-unknown v2026.10 +52 MiB blip reverted in v2026.11), `mdl_dxr` (realistic corpus), `api_session_create` (#9817 createGlobalSession delta). Memory page = 4-panel dashboard (vs 40 panels if all workloads promoted). Load-bearing for whoever reviews #12125; does NOT obviously touch the two R2 OPEN_GAPs (Windows include-order; unreachable `*Kb` trend alert) — watch whether 2edd1c4ba's trend/report changes resolve gap #2.

Originally **PARKED for assignee** — jvepsalainen-nv self-filed + self-assigned; owns sibling [[project_12100_generic_nesting_exponential_compile_parked]] (#12100/#12086) on the same tooling surface. Park-for-assignee pattern held.

**Verified @ c5d4d76e6:** bullet 1 (peak RSS per workload) is NOT greenfield — bench.py already captures `rss_kb` via GNU `/usr/bin/time -v` (bench.py:217-256) but it's dead: perf workflows run on the Windows pool where `/usr/bin/time` is absent → `rss_kb` silently None; nothing downstream reads it. Real work = portable capture (getrusage/GetProcessMemoryInfo, stdlib-only) + surfacing. Bullet 2 (session-create delta) genuinely new — api-driver.cpp has no memory measurement.

Files: tools/compile-perf/{bench.py,track.py}, native/api-driver.cpp; .github/workflows/{nightly-mdl-perf-test.yml,compile-perf-release-sweep.yml}. Cross-refs #9817 (motivating memory issue), #12100 (compile-time regression window), #12086 (sibling — coordinate report/track surface).
