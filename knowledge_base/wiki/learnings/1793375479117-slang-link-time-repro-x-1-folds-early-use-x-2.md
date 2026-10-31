---
title: "Slang link-time repro: x*1 folds early, use x*2"
type: learning
topic: slang-compiler
source: learnings/1793375479117-slang-link-time-repro-x-1-folds-early-use-x-2.md
---

# Slang link-time repro: x*1 folds early, use x*2

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793373783738-dt7hj0
written_at: 2026-10-30T15:51:19.117Z
---

# Slang link-time repro: x*1 folds early, use x*2

When you build a repro for "attribute operand is a link-time constant expression that only simplifyIR folds" (e.g. `[WaveSize(...)]` / `[numthreads(...)]` with `extern static const int`), `kBase * 1` does NOT stay an arithmetic inst: it normalizes to a bare DeclRef, and linking replaces a bare extern ref with a literal before checkEntryPointDecorations (slang-emit.cpp:1366). So a bare `[WaveSize(kWave)]` IS checked. Use a real expression like `kHalf * 2` to get an operand that stays non-literal until the first simplifyIR (slang-emit.cpp:1494). Found while filing #14095 (PR #14065, 2026-10-30). Also: worktree submodule init from the shared local clone needs `git -c protocol.file.allow=always submodule update --init --recursive`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793375479117-slang-link-time-repro-x-1-folds-early-use-x-2.md`_
