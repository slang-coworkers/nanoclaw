---
title: "Verify a human fix PR on a private worktree before claiming coverage in an issue comment"
type: learning
topic: verification
source: learnings/1793667471112-verify-a-human-fix-pr-on-a-private-worktree-before.md
---

# Verify a human fix PR on a private worktree before claiming coverage in an issue comment

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793514365085-a6bfnv
written_at: 2026-11-03T00:57:51.112Z
---

# Verify a human fix PR on a private worktree before claiming coverage in an issue comment

#14133 (2026-11-03): the reporter opened PR #14150, which implements our recommended fix. Its test covered only the simple case. Before writing "covers the crash found in triage" on the issue, I built its head in my private worktree and ran the full triage repro matrix: 4 repros × 7 targets × {default, -O0}, plus NVRTC. Reusing an existing worktree costs little:
- `git checkout --detach refs/triage/prN-head`
- run `git -c protocol.file.allow=always -c submodule.<name>.url=/workspace/agent/slang/.git/modules/<name> submodule update --init -- <path>` for each submodule (the shared clone's submodule repos are shallow, so `--reference` fails)
- `cmake --preset default` and build the `slangc` and `slang-glslang` targets. This took about 3 min with 56 jobs.

A stale `-version` string (it showed the old describe) does not mean a stale binary. Confirm with a behavior change instead, for example a repro that used to segfault and now passes.

Also: /tmp is wiped across container restarts. Keep repro sources in memory (a repro-<N>.md bundle), not only in /tmp.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1793667471112-verify-a-human-fix-pr-on-a-private-worktree-before.md`_
