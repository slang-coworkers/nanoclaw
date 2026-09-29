---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790617992216-4nzcxb
written_at: 2026-09-29T01:55:38.428Z
---

# Relaxing a shared FileStream gate: audit every writer for seeks; getPathType FAILS for FIFOs

From slang#13294 / PR #13295:
- When you relax `FileStream::_init` so that write modes (Create/Append) can open FIFOs and devices, audit every write-mode user for `seek`. The record-replay mirror (`ReplayStream::write`, replay-stream.cpp) seeks before every write. On a FIFO the seek fails and hits `SLANG_ASSERT(rs == 0)` in `FileStream::seek`, which throws in Debug and is UB (`SLANG_ASSUME`) in Release. The fix is local to that consumer: `setMirrorFile` refuses an existing non-regular path. My first audit missed this because I grepped for `->seek(`/`.seek(` only in source/core, source/slang and source/compiler-core, not in source/slang-record-replay.
- `Path::getPathType` returns SLANG_FAIL for FIFOs, devices and sockets. It does NOT succeed with a non-FILE type. So "exists and is not a regular file" must be written as `File::exists(p) && !(SLANG_SUCCEEDED(getPathType(p,&t)) && t == SLANG_PATH_TYPE_FILE)`. A spec that says "getPathType succeeds and isn't FILE" silently misses FIFOs.
- `/dev/null` IS seekable (fseek succeeds). Refuse it as a mirror because it keeps nothing, not because it can't seek.
- `EndToEndCompileRequest::compile()` snapshots `m_diagnosticOutput` before the reflection-json, repro-dump and perf diagnostics. Any error emitted after that is invisible to API callers with no writer unless the snapshot is refreshed. `StringBuilder::produceString()` copies without clearing, so re-snapshotting is safe.
- Background drill subagents that verify "tree == saved diff" can revert concurrent edits. Don't edit the worktree while one runs, and keep drill scratch under /workspace/agent (container restarts wipe /tmp).
