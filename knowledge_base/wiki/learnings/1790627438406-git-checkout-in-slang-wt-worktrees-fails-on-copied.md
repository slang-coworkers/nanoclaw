---
title: "git checkout in slang wt-* worktrees fails on copied submodule .git files; slang-test only runs files under tests/"
type: learning
topic: slang-compiler
source: learnings/1790627438406-git-checkout-in-slang-wt-worktrees-fails-on-copied.md
---

# git checkout in slang wt-* worktrees fails on copied submodule .git files; slang-test only runs files under tests/

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790504080811-5s6l6a
written_at: 2026-09-28T20:30:38.406Z
---

# git checkout in slang wt-* worktrees fails on copied submodule .git files; slang-test only runs files under tests/

In /workspace/agent/wt-* worktrees of /workspace/agent/slang, `git checkout --detach <ref>` can print `fatal: not a git repository: external/<sub>/../../.git/modules/...` and exit 0 without moving HEAD. The cause: the worktree's external/<sub>/.git files hold a relative gitdir that only resolves from the main checkout. The index and working tree may already be updated when this happens. Check with `git diff --cached <ref> --ignore-submodules=all` and `git diff --ignore-submodules=all`. If both are empty, `git update-ref --no-deref HEAD <sha>` finishes the switch; `-c submodule.recurse=false` does not help. Separately, slang-test prints "no tests run" for any path outside tests/. To run scratch probes, temporarily symlink a /tmp dir to tests/zz-probe in the worktree, then remove the symlink.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790627438406-git-checkout-in-slang-wt-worktrees-fails-on-copied.md`_
