---
type: project
title: slang-vscode-extension #76 — MEMFS sync for closed workspace modules
description: Triage-only disposition (2026-11-19) for the out-of-fleet slang-vscode-extension repo; no coworker owns it
---

# slang-vscode-extension #76 — triage disposition (2026-11-19)

**Repo status:** `shader-slang/slang-vscode-extension` has **no coworker** in my destinations
(no fixer/triager/reviewer) — webhook routing table covers only slang, slang-rhi, slangpy. New
issues there are triaged by me directly and reported to the operator; no bot fix chain is
dispatched.

**#76 "Synchronize closed workspace modules with the WebAssembly filesystem"** (author
tdavidovicNV, assigned kaizhangNV, opened 2026-08-24 — webhook delivery lag, reached the bot
2026-11-19):

- **Subsystem:** WASM/browser language-server path — `server/src/browserServerMain.ts` + the
  client-side preload/sync glue introduced by #73/#74 (MEMFS initialization snapshot +
  `didOpen`/`didChange` for open editors).
- **Severity:** Medium — correctness/staleness only (stale or missing MEMFS entries for closed
  `.slang` files changed by generators/Git/other editors, browser + playground workers only;
  native `slangd` unaffected, no crash/restart like #73).
- **Verdict:** valid, well-specified design/feature request, already a complete implementation
  spec. **Dependency-ordered, not yet actionable:** it explicitly builds on #75 (workspace
  membership/exclusion policy, still open) — the watcher must share #75's matcher so a file is
  never initially loaded then silently unwatched (recursive VS Code watchers may apply
  `files.watcherExclude`).
- **Next step:** land #75 first, then implement here: single recursive `FileSystemWatcher` on the
  #75 matcher, reread closed files via `workspace.fs`, MEMFS update/delete protocol for browser +
  native compiler workers, init-race reconciliation, event coalescing, #74 limit accounting.
  Disposition: leave to the human assignee; no bot chain.

Related: #73 (unbounded preload restart — RTR label), #74 (bounds, no activation-time preload),
#75 (exclusion policy). Posted 👀 2026-11-19.
