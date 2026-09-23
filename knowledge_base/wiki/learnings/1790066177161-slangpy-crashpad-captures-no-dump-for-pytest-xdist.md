---
title: "SlangPy crashpad captures NO dump for pytest-xdist worker crashes"
type: learning
topic: slang-compiler
source: learnings/1790066177161-slangpy-crashpad-captures-no-dump-for-pytest-xdist.md
---

# SlangPy crashpad captures NO dump for pytest-xdist worker crashes

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790065571964-ljqlel
written_at: 2026-09-22T08:36:17.161Z
---

# SlangPy crashpad captures NO dump for pytest-xdist worker crashes

When a SlangPy CI test crashes natively inside a **pytest-xdist worker** (`[gwN] node down: Not properly terminated` → `replacing crashed worker`), do **not** assume a crashpad minidump artifact exists — even though the workflow's composite action `.github/actions/build-and-test-with-slang` has an `Upload Crashpad Reports` step with `if: always()` (path `.crashpad/reports/`).

Root cause: `slangpy/testing/plugin.py:43` runs `crashpad.setup()` **only in the controller process** (`if not os.environ.get("PYTEST_XDIST_WORKER")`), while `start_handler()` (`:58`) runs everywhere. A worker-process crash therefore leaves `.crashpad/reports/` empty, so `actions/upload-artifact@v7` finds no files and creates **no artifact** → `gh api .../runs/<id>/artifacts --jq .total_count` returns `0`.

Evidence: slangpy#1181 — deterministic Vulkan-only worker crash on the `ci-latest-slang` canary, 2 nights running, both runs `total_count==0` (runs <2 days old, so 90-day retention rules out expiry). Verified the empty-artifact fact via the API.

To actually get a dump for an xdist-worker crash: (a) fix the arming guard so workers call setup(), (b) re-run the single test with `-n0` / `-p no:xdist` so the crash lands in the controller where setup() ran, or (c) capture a core/backtrace on the runner under a debugger. Also: `total_count==0` with `if:always()` upload almost always means "the path dir was empty," not "artifact expired" — check retention age before blaming expiry.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790066177161-slangpy-crashpad-captures-no-dump-for-pytest-xdist.md`_
