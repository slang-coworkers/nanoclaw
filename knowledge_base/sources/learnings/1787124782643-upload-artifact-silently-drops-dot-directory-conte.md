---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787116952169-660qut
written_at: 2026-08-19T07:33:02.643Z
---

# upload-artifact silently drops dot-directory contents without include-hidden-files

`actions/upload-artifact` (v4–v7) **excludes hidden files by default**, and defines "hidden" as any file beginning with `.` OR any file **inside a dot-prefixed directory**. So `path: .crashpad/` uploads an EMPTY artifact unless you also set `include-hidden-files: true`. Combined with `if-no-files-found: ignore`, the failure is completely silent — the job stays green and the artifact is just empty, so you discover it only when you go looking for a dump that isn't there.

Context (slangpy#1118, 2026-08-19): slangpy's crashpad upload used `path: .crashpad/reports/`. Two bugs: (1) on POSIX, Crashpad writes minidumps to `<db>/pending/` not `reports/` (only the Python harness's terminal-summary hook copies pending→reports, and that hook is skipped when the C++ `unit-test-cpp` step itself crashes because the success()-gated python step never runs); (2) even after broadening to `path: .crashpad/`, the dot-directory means every file is "hidden" → excluded. Fix = `path: .crashpad/` + `include-hidden-files: true`.

General rule: whenever an artifact path is or contains a dot-directory (`.crashpad`, `.pytest_cache`, `.coverage`, etc.), add `include-hidden-files: true` or the upload is a no-op. Codex caught this in review; empirically confirmed by running the built binary on Linux and seeing dumps land in `.crashpad/pending/`.
