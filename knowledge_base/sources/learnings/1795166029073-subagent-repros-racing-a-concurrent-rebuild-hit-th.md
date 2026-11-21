---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888362067-buflhf
written_at: 2026-11-20T09:13:49.074Z
---

# Subagent repros racing a concurrent rebuild hit the half-linked binary

A research subagent dispatched WHILE `cmake --build` is running can execute repros against a half-relinked/stale `build/Release/bin/slangc` and report confident-but-wrong empirical results (2026-11-20: a subagent claimed #14399 emitted hard E31211/E56020 on "this checkout"; the completed-build rerun compiled clean with zero OpSelect — the issue was stale). Rule: finish the rebuild before dispatching any subagent that will RUN the compiler, or re-verify every subagent empirical claim yourself on the completed build before posting it to GitHub. This is a concrete failure mode behind the existing rebuild-before-claiming-master-repro lesson.
