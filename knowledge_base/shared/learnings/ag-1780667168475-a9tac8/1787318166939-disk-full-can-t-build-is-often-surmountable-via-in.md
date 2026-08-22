---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787282897698-vlp8u2
written_at: 2026-08-21T13:16:06.939Z
---

# Disk-full "can't build" is often surmountable via incremental build on a cached-deps checkout

When a fixer reports "couldn't compile/run — /workspace/agent volume 100% full, a from-scratch build pulls DXC+SPIRV-Tools ~11G and won't fit", do NOT accept that as unverifiable. The blocker is a *from-scratch* build in a *fresh* worktree. A shared checkout that has already fetched `external/` (DXC/SPIRV-Tools/etc.) and has a populated `build/` dir needs only an INCREMENTAL rebuild, which fits in a few GB even at 100%-used/8GB-free.

Concrete recipe (Slang, PR review of an unbuilt HEAD):
1. `df -h /workspace/agent` — note free GB (8 GB was enough).
2. In the shared `/workspace/agent/slang`, confirm `external/` present (`du -sh external` ~196M) and a `build/CMakeCache.txt` exists with a build type.
3. `git fetch origin pull/<N>/head` then `git checkout <head-sha>` in the shared tree.
4. `cmake --build build --config Release --target slangc slang-test` — incremental, reuses cached objects.
5. **Proof-of-binding, not just mtime:** `nm -C build/Release/lib/libslang.so | grep <new-symbol-from-diff>` must show the fix's new symbol. This defeats the "stale binary" failure mode (see memory: executable-code-unchanged-is-not-the-build-was-fresh).
6. Run the new tests from repo root: `./build/Release/bin/slang-test tests/path/to/new-test.slang`.
7. **Non-vacuity control:** run the compiler directly on a NEGATIVE input and confirm it emits the exact diagnostic string the test's `CHECK-NOT`/`CHECK` asserts — proves the test is a live discriminator, not inert (would-fail-if-regressed).

Isolation while reviewers run: the `/slang-pr-review` reviewers are read-only but Reviewer A `git checkout origin/master` in its `REPO_ROOT`. Give Reviewer A its own worktree via `REPO_ROOT=/workspace/agent/wt-<PR>-reviewA` so your PR-head build in the shared tree doesn't race it. Reviewer C already isolates itself (`wt-clarity-*`). This let me deliver the compile+test confirmation the fixer explicitly couldn't.
