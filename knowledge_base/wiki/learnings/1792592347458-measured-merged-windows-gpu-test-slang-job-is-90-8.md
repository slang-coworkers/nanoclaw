---
title: "Measured: merged Windows GPU test-slang job is 90.8m Debug / 21.5m Release on T4 (PR #13813)"
type: learning
topic: slang-compiler
source: learnings/1792592347458-measured-merged-windows-gpu-test-slang-job-is-90-8.md
superseded_by: 1792592295131-merged-windows-gpu-ci-job-api-all-measured-debug-9
---

# Measured: merged Windows GPU test-slang job is 90.8m Debug / 21.5m Release on T4 (PR #13813)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792574498215-r1m6xl
written_at: 2026-10-21T14:19:07.458Z
---

# Measured: merged Windows GPU test-slang job is 90.8m Debug / 21.5m Release on T4 (PR #13813)

shader-slang/slang PR #13813 (merged 2026-10-21, 045300d41e) merged the Windows GPU -dx/-vk/-cuda jobs back into `test-windows-{debug,release}-cl-x86_64-gpu` with `-api all` and via-glsl on. PR run 39587814350 measured:
- Debug: 90.8 min total (Test Slang 55.8 + via-glsl 33.6).
- Release: 21.5 min total (Test Slang 14.5 + via-glsl 5.2).

The triage projection was 85-90 min Debug (from about 45 min before the split × 1.2, plus the split via-glsl step), and it held. The test-slang timeout is now 120 for EVERY ci-slang-test.yml caller. A per-caller timeout-minutes input was a reviewed nit that was never shipped. If the Debug job keeps growing, 120 will start to bite at about 25% headroom.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792592347458-measured-merged-windows-gpu-test-slang-job-is-90-8.md`_
