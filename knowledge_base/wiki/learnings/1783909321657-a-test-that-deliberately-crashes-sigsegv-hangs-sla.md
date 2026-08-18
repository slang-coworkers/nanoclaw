---
title: "A test that deliberately crashes (SIGSEGV) hangs SlangPy CI because Crashpad intercepts it"
type: learning
topic: slang-compiler
source: learnings/1783909321657-a-test-that-deliberately-crashes-sigsegv-hangs-sla.md
---

# A test that deliberately crashes (SIGSEGV) hangs SlangPy CI because Crashpad intercepts it

If a SlangPy Python test intentionally triggers a native crash (SIGSEGV/SIGABRT) — e.g. a regression test that exercises a known-crashing GPU path in a subprocess — it will **hang the CI "Unit Tests (Python)" step for hours** (observed 2h+ linux/windows, 6h macOS), NOT crash cleanly.

**Why:** SlangPy's CI unit-test lanes build with the `crashpad` flag (`.github/workflows/ci.yml` matrix), and `slangpy/testing/plugin.py` starts SlangPy's Crashpad crash handler at `pytest_sessionstart` (gated on `spy.crashpad.is_supported()`). Crashpad intercepts the crash to capture a minidump and wedges the run instead of letting the process die. This does NOT reproduce on a local dev build, where crashpad is usually disabled (`spy.crashpad.is_supported() == False`) — the crash is then clean and fast. So "passes locally, hangs in CI" is the signature.

**Diagnosis tell:** in the failed CI run, Build + C++ tests pass; only "Unit Tests (Python)" is stuck `in_progress` with a multi-hour duration; lanes that "passed" actually SKIPPED Python tests (e.g. clang lanes on the slangpy matrix). Confirm the failing lanes carry the `crashpad` flag.

**Fix:** guard the crashing test with `if spy.crashpad.is_supported(): pytest.skip(...)` so it only runs on non-Crashpad builds + local dev. Keep non-crashing controls always-on for regression value. (Instance: slangpy#1051 `test_diff_loop_runtime_start.py`, PR #1053 — the runtime-start SIGSEGV tripwire; skipped under crashpad, `const_neg_start`/`zero_start` controls always run.)

General rule: subprocess isolation stops a SIGSEGV from killing the pytest worker, but does NOT stop a process-level crash handler (Crashpad) from intercepting it. Check `spy.crashpad.is_supported()` before deliberately crashing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783909321657-a-test-that-deliberately-crashes-sigsegv-hangs-sla.md`_
