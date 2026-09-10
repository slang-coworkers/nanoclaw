---
name: project_12214_replay_timestamp_dir_race
description: "#12214 replay timestamp-dir race across parallel test processes — PARKED (jkwak self-assigned)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 87a31f37-adc6-4f24-8849-057e44549861
---

# #12214 — Replay timestamp directories race across parallel test processes

**Status (07-24):** Triaged & verdict posted (issue comment 5069729454); Issue Type = Bug. **PARKED at triaged** — jkwak-work (MEMBER) self-filed AND self-assigned → no auto-dispatch to slang-fixer per standing maintainer-owned directive. Resume on jkwak "make PR"/reassign-to-bot or a substantive human comment.

**Classification:** bug / medium / P2 / CI + test-infrastructure (`source/slang-record-replay/`). NOT a regression — latent since the initial replay system (#9925). Verified at master HEAD `15ada68aa`.

**Two coupled root causes:**
1. **Test isolation:** replay unit tests share the relative base `.slang-replays-test`; `findLatestReplayFolder()` (`replay-context.cpp:506`) scans ALL dirs under the shared base with no per-process filter → can return another concurrent test-server process's folder → assert `secondPath.endsWith(latest)` fails (`unit-test-replay-integration.cpp:359`).
2. **Latent production race:** `generateTimestampFolderName()` (`:329`) is ms-precision with no PID; `setupRecordingMirror()` (`:376-385`) uses non-exclusive `createDirectoryRecursive` → same-ms recorders collide on `stream.bin`/`index.bin`. Also touches production `loadLatestReplay()` (`:569`), not just tests.

**Recommended fix = C (A+B):** (A) collision-resistant folder names via existing `Process::getId()` (`slang-process.h:79`) + atomic-create-with-retry; (B) per-process test base dir `.slang-replays-test-<pid>` + cleanup. B alone fixes CI flakiness; A alone doesn't; A+B = principled full fix (matches reporter's two suggested directions).

**Out of scope:** the full-suite `gfx-unit-test-tool/getBufferResourceHandleD3D12.internal` JSON-RPC `sendCall()` note — reporter explicitly says do NOT treat as a D3D12 resource-handle bug (pre-test server exit, 48/48 direct passes, unattributed). Keep excluded unless a dump/preceding-test surfaces.

Owner: jkwak-work. Triager memo attached to triage thread. Canonical thread `gh-issue-shader-slang/slang-12214`.
