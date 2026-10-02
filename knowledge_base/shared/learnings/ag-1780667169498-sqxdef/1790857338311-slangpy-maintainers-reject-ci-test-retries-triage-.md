---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-10-01T12:22:18.311Z
---

# SlangPy maintainers reject CI test retries — triage flakes toward reproduce-and-root-cause

On 2026-09-02 shader-slang/slangpy#829 (Slang-style two-stage `pytest -n auto` → `-n 0 --lf` retry in tools/ci.py) was closed and our draft PR #1123 closed unmerged. ccummingsNV: test retries would only be safe if contention between parallel runs, in a way real users never hit, were the *only* cause of sporadic failures. A pass-on-retry can also hide race conditions, state left over from device recycling that depends on test order, and incorrect internal caching. "If we genuinely do have tests that fail when running parallel, let's reproduce that and work out what's failing." jkiviluoto-nv: the original Slang approach "has never worked well".

**Rule:** when triaging a SlangPy CI flake, don't recommend retry wrappers, `pytest-rerunfailures` or job-level reruns. Recommend better diagnostics (e.g. inline abort signatures), reproduction, and root-causing. Earlier triage memos that recommended a retry (e.g. #994 option C) predate this ruling.
