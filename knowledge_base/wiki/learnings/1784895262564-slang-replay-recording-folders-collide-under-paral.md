---
title: "Slang replay recording folders collide under parallel test-server processes (no PID in name)"
type: learning
topic: slang-compiler
source: learnings/1784895262564-slang-replay-recording-folders-collide-under-paral.md
---

# Slang replay recording folders collide under parallel test-server processes (no PID in name)

**shader-slang/slang#12214** (triaged 2026-07-24 @HEAD 15ada68aa). The record-replay system's recording-folder naming has a parallel-process race with two facets:

1. **Test isolation flaw (the observed CI failure).** All replay unit tests share the relative base dir `.slang-replays-test`. `ReplayContext::findLatestReplayFolder(baseDir)` (`source/slang-record-replay/replay-context.cpp:506`) lists+sorts EVERY directory under the base with NO per-process ownership filter and returns `.getLast()`. Under `slang-test -use-test-server -server-count N`, another concurrent test-server process's lexicographically-newer folder can be returned, so the test's `secondPath.endsWith(latest)` assertion (`tools/slang-unit-test/unit-test-replay-integration.cpp:359`) fails intermittently (reporter: 15/96 forced runs).

2. **Production naming collision (latent, same code).** `ReplayContext::generateTimestampFolderName()` (`replay-context.cpp:329`) is millisecond-precision with NO process-unique component; `setupRecordingMirror()` (`:376`–`:385`) combines it with the shared base via a NON-exclusive `Path::createDirectoryRecursive`. Same-ms recorders open the same `stream.bin`/`index.bin`. This touches the PRODUCTION `.slang-replays` path too — `findLatestReplayFolder` backs `ReplayContext::loadLatestReplay()` (`:569`), not just tests.

**Fix directions (reporter-suggested, at their layers):** (A) collision-resistant folder names — append PID via the EXISTING `Process::getId()` (`source/core/slang-process.h:79`, returns `uint32_t`; unix `getpid()`, win `_getpid()`) + atomic-create-with-retry (there is NO `mkdtemp`/O_EXCL helper, but `Path::createDirectory` = plain `mkdir`/`_wmkdir` gives atomic-EEXIST on the leaf); (B) per-process test base dir `.slang-replays-test-<pid>` with cleanup. **B alone fixes the CI flakiness; A alone does NOT; A+B is the principled full fix.**

Not a regression — latent since the initial replay system (#9925 / commit 040efca16). `loadLatestReplay()`'s "latest folder in base = my recording" semantic is inherently single-writer (design note for follow-up, not the bug fix).

**Method note:** jkwak-work self-filed AND self-assigned → PARK-at-triaged, no auto-dispatch to fixer per standing directive.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784895262564-slang-replay-recording-folders-collide-under-paral.md`_
