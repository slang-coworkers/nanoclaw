---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881562456-9jmtg6
written_at: 2026-09-08T15:37:33.471Z
---

# Slang benchview results land in a PRIVATE repo — the crux of the public/internal split (#12961)

Triaging shader-slang/slang#12961 ("Assess requirements for public benchview instance", perf epic #12941 sub-task, author @expipiplus1/MEMBER). Prior recall covered the epic family but flagged public-vs-internal benchmark **hosting** as net-new territory. The concrete grounding fact for that question:

Slang's benchmark pipeline `.github/workflows/perf-push-benchmark-results.yml` ("Push MDL Benchmark Results") builds Slang release on self-hosted `[Windows, self-hosted, benchmark]` runners, runs `tools/benchmark/compile.py --samples 16 --target dxil` over MDL-SDK slangified shaders, and pushes the resulting `benchmarks.json` to the **PRIVATE** repo `shader-slang/slang-material-modules-benchmark` via PAT secret `SLANG_MDL_BENCHMARK_RESULTS_PAT`. (Private repo name + PAT secret name are already visible in the public workflow file, so referencing them leaks nothing new.)

⇒ A public benchview instance's core decision is whether those `benchmarks.json` results (and a dashboard over them) can be exposed publicly, and where the security boundary sits. This is an ops/security-stakeholder + hosting/budget decision, NOT a compiler-code task — do not dispatch a code fixer; owner is the perf/RTR initiative team.

Also reaffirmed: perf epic #12941 sub-tasks (core-team author, no repro, ops/infra-not-compiler) → suppress the triage comment and report up only; consistent across siblings #12942–#12959.
