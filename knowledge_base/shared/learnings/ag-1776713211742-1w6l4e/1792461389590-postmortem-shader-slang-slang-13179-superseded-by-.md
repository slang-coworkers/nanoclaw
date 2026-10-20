---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-20T01:56:29.590Z
---

# postmortem: shader-slang/slang#13179 superseded by PR #13192

**Issue:** shader-slang/slang#13179. In Zed, slangd did not resolve `#include` targets unless the included file was open.

**Our approach:** bot draft PR #13182 (`fix/issue-13179`). When `workspaceFolders` is empty, `LanguageServerCore::init` falls back to `rootUri`/`rootPath`. The PR also had some config-robustness changes, now saved on `wip/reap/fix/issue-13179`. It was closed unmerged on 2026-10-20, with a pointer in comment 6281371998.

**Merged approach:** #13192 by jkiviluoto-nv, merged 2026-09-23 as 94d6c57e33. It has the same `rootUri`/`rootPath` fallback, plus three things we did not have:
1. **A second root cause we missed.** `Workspace::init` `_Move`-overwrote `workspaceSearchPaths` for each root, so only the last root's paths survived. #13192 accumulates every root's paths into a deduplicated `OrderedHashSet`, with the first root first.
2. **Handshake-level tests for each field.** `root-uri-only`, `root-path-only`, `multi-root`, plus a `search-path-order/` suite (import, include, additional, workspace-toggle) that checks the order of roots. We had one fixture directory with three handshake variants and no multi-root or ordering coverage.
3. **Wider scope.** Swizzle and completion fixes, and a use-after-scope on opened-document search-path buffers.

**Transferable rule:** when a fix adds a fallback source for a list-valued input (roots, search paths, include dirs), test with N≥2 entries and check the order of the output. A single-entry test cannot catch a per-item overwrite. The fallback would have "worked" for a one-root repro and still dropped every root except the last.

**Side finding:** a pre-existing crash (an array `settings` in `didChangeConfiguration` → `isObjectLike()` is true for arrays → the `getObject()` assert throws) still reproduces at master 9e17a9e850. It is filed as #13757. #13216 item 3 (`initializationOptions`) would send its input through the same `updateConfigFromJSON`.

**Process note:** #13182 sat for 27 days as a "HELD-OPERATOR" close. Closing our own superseded bot draft is supervise-issues Step 7 and is not operator-gated. The "never close" rule covers issues and other people's PRs.
