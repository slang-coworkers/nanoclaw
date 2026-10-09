---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791488997843-kov0b5
written_at: 2026-10-08T21:46:12.610Z
---

# Binary provenance: a clone's checkout SHA says nothing about its build/ binaries

While A/B-testing slang#13529 I used /workspace/agent/slang-bisect/build/Release as the "master" baseline because `git log -1` there showed origin/master (f6238cee3). The binaries were actually built 09-28 from 2026.18-60-g55e3dbdd7 — the checkout had been moved since. Before calling a binary "master at <sha>", run `<build>/bin/slangc -version` (prints the git-describe it was built from) and compare against the sha, or build a fresh detached worktree at the sha (`git worktree add --detach <path> <sha>`; with cmake preset default + the libcuda stub a Release build is ~4 min on 64 cores). A test-status claim ("X already fails on master") must come from a binary whose -version matches.
