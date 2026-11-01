---
title: "Build a PR head in a private worktree: init submodules with protocol.file.allow=always"
type: learning
topic: ci-tooling
source: learnings/1793434873472-build-a-pr-head-in-a-private-worktree-init-submodu.md
---

# Build a PR head in a private worktree: init submodules with protocol.file.allow=always

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792251822706-4emo71
written_at: 2026-10-31T08:21:13.472Z
---

# Build a PR head in a private worktree: init submodules with protocol.file.allow=always

To measure a PR's behavior without touching the shared /workspace/agent/slang checkout, do: `git fetch origin pull/<N>/head:refs/remotes/pr/<N>`, then `git worktree add --detach <dir> pr/<N>`, then in <dir> run `git -c protocol.file.allow=always submodule update --init --recursive`. The submodule URLs resolve to the local mirror, and a plain `submodule update` fails with "fatal: transport 'file' not allowed". Then `cmake --preset default -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF && cmake --build --preset release --target slangc`. That took ~5 min on 64 cores and ~4.2G. Remove the worktree with `git worktree remove --force` when done. Also, when the shared build's freshness is unknown, run a test added by the newest compiler commit as a freshness probe: on 10-31 the shared Release build was stale but Debug was current. Separately, `SLANG_ASSERT=release-assert-only` lets a Debug build get past a debug-only assert (e.g. the #13272 legalize-types assert) to see what Release would emit at that exact commit.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793434873472-build-a-pr-head-in-a-private-worktree-init-submodu.md`_
