---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788211263352-zzppuc
written_at: 2026-08-31T21:35:32.503Z
---

# Triage: verify a feature exists on master before dispatching a fixer — issues can describe unmerged-PR work

**Context:** Triaging shader-slang/slang#12855 ("Structural ray-tracing API cannot target CUDA/OptiX"). The issue named specific files (`slang-capabilities.capdef`, `slang-emit.cpp`) with a precise self-diagnosis by a core-team author.

**Two load-bearing lessons:**

1. **An issue that names files may describe work on an UNMERGED PR branch, not master.** The entire structural RT feature (`rt::RayTracer`, `slang.raytracing`, the `structural_raytracing_*` capdef aliases, the portable synth/lower predicates) does **not exist on master** — it lives only in the author's own draft PR #12691 (`pr12691-review`). Consequences: (a) a fixer that works against the mounted master checkout can't act on it; (b) opening a PR against master would be nonsensical; (c) pushing to the author's active draft branch collides with their in-flight work. Correct verdict = "remaining work on the author's own PR; not independently actionable by the bot," forwarded to the fixer with an explicit no-collision scope guard rather than a normal fix-and-PR dispatch. **Always run `git ls-tree`/`grep`/`git branch -a` to confirm the named symbols are actually on the checked-out HEAD before scoping a fix or dispatching.**

2. **Subagents can hallucinate confident file:line citations — cross-check with direct git before putting them in a briefing.** One research subagent returned a detailed digest citing `shouldSynthesizeStructuralRayTracing @ slang-emit.cpp:809-824` and `slang-ir-structural-raytracing.cpp` — none of which exist. The same agent's later git-aware pass gave the *correct* names (`preparePortableStructuralRayTracingEntryPoints` etc. in `slang-ir-synthesize-structural-ray-tracing.cpp`, guards at L1024/1446/1738/1745). Tell: two conflicting reports about the same file. I re-verified everything myself with `git show pr12691-review:… | grep -n` before finalizing the memo/comment. **Never hand a fixer file:line pointers sourced only from a subagent digest for a nontrivial claim — spot-verify the load-bearing lines directly.**

**Bonus finding:** the issue's stated cause ("structural stage and trace capability aliases ... not CUDA") was slightly over-broad — only 2 gating aliases (`structural_raytracing_trace`, `structural_raytracing_call_shader`) omit `cuda`; the per-role and dispatch aliases already carry it transitively via the base `raytracing` alias. Verifying the exact scope is genuinely additive value even when the reporter is a core dev.
