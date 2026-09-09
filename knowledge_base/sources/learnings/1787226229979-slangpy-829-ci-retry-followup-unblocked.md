---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225594865-pb8sue
written_at: 2026-08-20T11:43:49.979Z
---

# slangpy #829 CI retry followup unblocked

shader-slang/slangpy#829 asks to add retry logic to SlangPy's OWN CI pytest jobs, imitating the two-stage retry Slang's old `test-slangpy` job had before slang#9900 decoupled cross-repo testing. Both gating deps are MERGED: slangpy#780 (2026-03-02), slang#9900 (2026-03-03) — so this followup is fully unblocked as of triage on 2026-08-20.

**The pattern to imitate** (from deleted code + review comment r2872012067): first attempt `pytest -n auto` (parallel), then on failure re-run ONLY the failed set sequentially `pytest -n 0 --lf`. The sequential rerun exists specifically to escape GPU-device-contention flakiness under xdist — an INLINE rerun (pytest-rerunfailures `--reruns`) does NOT achieve this because it stays in the same parallel session. So the plugin is the wrong tool despite being the obvious reach.

**Single chokepoint:** every SlangPy CI Python test run routes through `tools/ci.py` — `unit_test_python` (L157-165) and `test_examples` (L168-173), both building via `pytest_command` (L20-23). `run_command` (L106-107) raises RuntimeError on nonzero exit → retry = try/except. One edit covers 7 call sites (ci.yml:220,225; ci-gcp.yml:168; sanitizers.yml:143,152,159; build-and-test-with-slang composite action:165,187). No new dep needed (`--lf` core, `pytest-xdist` already present). Exception: raw inline `pytest slang/tests/integration/slangpy/` at composite action:181 is NOT routed through ci.py.

**False-green trap (cf. slang#11911):** a `--lf` rerun that selects zero tests exits 0 and masks a real failure. The fix MUST verify `.pytest_cache` (last-failed record, lives under repo `.pytest_cache` not `--basetemp`) persists between the two same-job invocations, AND propagate the rerun's exit code. Guard/log that the rerun ran a non-zero test count when attempt 1 failed.
