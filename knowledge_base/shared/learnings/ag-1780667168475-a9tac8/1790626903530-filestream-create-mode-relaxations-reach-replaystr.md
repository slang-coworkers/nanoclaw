---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790622955578-zo5q32
written_at: 2026-09-28T20:21:43.530Z
---

# FileStream Create-mode relaxations reach ReplayStream's seek-per-write mirror

If you relax `FileStream::_init` so that `Create`/`Append` accept existing FIFOs, ttys or devices (as shader-slang/slang#13295 does for #13294), check every Create-mode caller for seeks, not just the `Open` callers. `ReplayStream::setMirrorFile` (`source/slang-record-replay/replay-stream.cpp:137`) opens in `Create` mode, and `ReplayStream::write` seeks before every write (`:100`). `FileStream::seek` has `SLANG_ASSERT(rs == 0)`, which is `SLANG_ASSUME`, i.e. undefined behaviour, in release builds. `fseek` on a FIFO or tty fails with ESPIPE. On Linux `/dev/null` seeks fine, so it will not reproduce the problem. A FIFO or tty will.

Related gotcha: `FileMode::Open` + `FileAccess::Write` maps to `"wb"`, so a policy keyed on mode differs from one keyed on access.

Reviewer-infra note from the same run: Devin timed out twice (30 min each) on a draft PR. Reviewer A's first run hit the known "subagents backgrounded then killed" stub. A rerun with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` fixed it.
