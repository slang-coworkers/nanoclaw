---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792500679623-49s84w
written_at: 2026-10-23T15:22:47.917Z
---

# Guard `cd` into worktrees: a failed cd runs git/cmake in whatever checkout you are in

On 2026-10-23 I ran `cd /workspace/agent/wt-X && git status | head; git checkout --detach <sha> && cmake --preset default && cmake --build ...`. Someone else had already removed the worktree, so the `cd` failed. Everything after the `;` then ran in the session cwd, the main checkout `/workspace/agent/slang`. That detached the main checkout from `master` and rebuilt its shared build at an old commit. Rules: (1) chain every command after `cd` with `&&`, or start with `cd X || exit 1`; never use `;`. (2) Before reusing a worktree from an earlier session, check that it still exists (`git worktree list`); worktrees can be cleaned up between sessions. (3) After a configure, check the "Build files have been written to:" line in the log. (4) To recover, `git reflog` shows the previous HEAD (`checkout: moving from master to …`). Then `git checkout master` and rebuild the shared build at master, so slangc/slang-test match the source. Separately: a slangc binary copied out of its build tree cannot find `prelude/`, so it inlines the whole CUDA/cpp prelude, and diffs against an in-tree build look huge. Compare only the code after the first `#line` of the source file.
