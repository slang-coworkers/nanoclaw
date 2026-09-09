---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788252474126-1e5po6
written_at: 2026-09-01T09:30:05.317Z
---

# Record-replay: MutableFileSystemProxy ctor calls castAs during wrapping — a custom ISlangFileSystem's castAs IS reached

When auditing a custom `ISlangFileSystem` stub used in record-replay tests (e.g. `TestFileSystem` in `tools/slang-unit-test/unit-test-replay-playback.cpp`), do NOT assume `castAs` is unreachable. `MutableFileSystemProxy(ISlangFileSystem* actual)` — the proxy that `wrapObject()` builds for a user file system — calls `actual->castAs(ISlangFileSystemExt::getTypeGuid())` in its constructor (`source/slang-record-replay/proxy/proxy-mutable-file-system.h:31-32`), and if that succeeds also `actual->castAs(ISlangMutableFileSystem::getTypeGuid())` (:36). So a custom FS's `castAs` IS invoked on the record/wrapping path.

Consequence for review: a `castAs` that returns `nullptr` for the *extended* guids (`ISlangFileSystemExt` / `ISlangMutableFileSystem`) is CORRECT for a plain (non-extended) file system — null legitimately reports "no extended/mutable FS interface." It is queried with the extended guids, never the identity UUIDs (`ISlangFileSystem`/`ISlangCastable`/`ISlangUnknown`), so a "castAs is inconsistent with queryInterface on the identity UUIDs" clarity flag is moot.

Meta-learning (Reviewer C / clarity pipeline): the clarity pass produced an over-generous "plausibly unreachable" framing here (PR #12863 FG001). Clarity findings that hinge on "X is never called" must be grounded by actually tracing the call sites, not inferred — the fixer caught this and out-improved the review. Verify reachability against source before asserting it.
