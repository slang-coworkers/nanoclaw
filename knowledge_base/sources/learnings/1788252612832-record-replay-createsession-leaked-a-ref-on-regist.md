---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788249332526-y9k3ch
written_at: 2026-09-01T08:50:12.832Z
---

# Record-replay createSession leaked a ref on registered-FS reuse; live-count stub catches it

Writing the requested coverage for shader-slang/slang#12470 surfaced a **real reference leak** in
`GlobalSessionProxy::createSession` (`source/slang-record-replay/proxy/proxy-global-session.h`),
not just a missing test. The pattern is worth remembering.

**The bug (post-#12449):** `createSession` did `desc.fileSystem->addRef()` unconditionally before
branching on `isInterfaceRegistered(desc.fileSystem)`. That addRef exists only to feed
`wrapObject()`→`tryWrap()`'s ownership-transfer `release()` (`proxy-base.cpp:30`, "the proxy now
owns it"). But `tryWrap()` runs only on the **not-yet-registered** branch; on the
already-registered branch `wrapObject()` early-returns the existing proxy
(`proxy-base.cpp:59-64`) with `existing->addRef()` on the *proxy* and never releases the file
system. So passing the *same* custom `ISlangFileSystem` to `createSession` twice leaked one ref on
the user FS. Fix: move the addRef into the not-yet-registered branch. The playback `default:` arm
is leak-free because `toSlangInterface` (`replay-shared.h:102-105`) queries-then-releases → a
borrowed pointer, so `ownsFileSystemWrapper=false` there is correct — the defect was purely
write-side.

**Reusable techniques:**
- A `static std::atomic<int> s_liveCount` on a minimal in-test COM object (incremented in ctor,
  decremented in dtor) is a **deterministic, sanitizer-independent leak assert**: drop every owner
  (sessions, `ctx().reset()` to drain playback orphans), then null your own pointer and assert
  `s_liveCount==0`. Catches ref leaks in a plain Debug run where LSan isn't wired.
- To reach the record-replay `default:`/registered arm, call `createSession` twice with the same
  FS object — handles are assigned in creation order, so playback re-derives the same handle and
  routes the second call through `default:`.

**Build/tooling (worktree):** `git submodule update --init --recursive` first (external/ is empty
in a fresh worktree). Unit-test CMake target is `slang-unit-test` (binary `libslang-unit-test-tool.so`);
run via `./build/Debug/bin/slang-test slang-unit-test-tool/<TestNamePrefix>`. `clang-format-17` lives
at `/usr/bin/clang-format-17` even when `extras/formatting.sh` can't find an unversioned `clang-format`.

General lesson: when a triager flags an "unmeasured arm whose failure mode a leak-net can't catch,"
treat the coverage task as potentially a bug hunt — the missing test often exists because the arm
was wrong.
