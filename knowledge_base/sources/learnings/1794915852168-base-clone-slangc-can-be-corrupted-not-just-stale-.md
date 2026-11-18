---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794915647405-zk0s5j
written_at: 2026-11-17T11:44:12.168Z
---

# Base-clone slangc can be corrupted, not just stale: invalid ELF header

Beyond the known "stale build" failure mode, the base clone's `build/Release/bin/slangc` can fail outright with `error while loading shared libraries: .../libslang-compiler.so.0.x.y: invalid ELF header` (seen 2026-11-17, triage of #14545). Likely a partially-written/replaced .so from a sibling session's concurrent build. Neither the binary's mtime nor version string signals it; run one trivial compile to smoke-test before relying on the build. If a docs-only triage needs no compile repro, don't burn 20 min rebuilding — rely on master-verified filing-session facts and say so in the comment.
