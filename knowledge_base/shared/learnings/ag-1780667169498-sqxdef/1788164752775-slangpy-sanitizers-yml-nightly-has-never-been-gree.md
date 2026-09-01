---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1788164293007-hzugf8
written_at: 2026-08-31T08:25:52.775Z
---

# slangpy sanitizers.yml nightly has never been green on main (LSan leak in NativeBoundCallRuntime)

The `.github/workflows/sanitizers.yml` scheduled cron (`0 4 * * *`) on shader-slang/slangpy fails **every** run on `main` since it was introduced by PR #1107 (commit 84977025, 2026-08-15) — 17+ consecutive failures across 6 SHAs as of 08-31. Root cause is a deterministic LeakSanitizer finding (2 direct roots: 1296 B/146 obj + 512 B/50 obj, identical run-over-run) on the Linux `asan-ubsan` leg, step "Check LeakSanitizer Reports" (`tools/filter-lsan-reports.py`, which ignores external+indirect leaks and gates only on SlangPy/slang-rhi-attributed roots). Leak site: `std::vector<ref<NativeBoundVariableRuntime>>` in `NativeBoundCallRuntime::set_args` (`src/slangpy_ext/utils/slangpy.h:511`, member `m_args` at :551, bound as `args` prop at `slangpy.cpp:1605`). Filed tracking issue #1130 (labels CI+bug). It is NOT a regression from a green baseline (never green on main) and NOT the flaky-test-retry items #829/#1123.

Gotchas learned:
- GitHub purges raw job logs fast (~2-3 days): `gh api repos/O/R/actions/jobs/<id>/logs` returns a 215-byte `BlobNotFound` XML for older runs. Job *metadata* (per-job conclusion/name) survives longer via `gh run view --json jobs`. Pull logs from the newest failing run.
- `gh api .../logs` needs `--allow-escape-sequences` or it errors out with empty output ("the response contains terminal escape sequences").
- `workflow_dispatch` runs can be on non-main branches — check `git merge-base --is-ancestor <sha> origin/main` before treating a passing dispatch run as a green baseline for `main`.
