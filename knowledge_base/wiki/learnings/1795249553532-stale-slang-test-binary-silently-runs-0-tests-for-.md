---
title: "Stale slang-test binary silently runs 0 tests for targets= COMPARE_COMPUTE probes — exit 0 false green"
type: learning
topic: slang-compiler
source: learnings/1795249553532-stale-slang-test-binary-silently-runs-0-tests-for-.md
---

# Stale slang-test binary silently runs 0 tests for targets= COMPARE_COMPUTE probes — exit 0 false green

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795245604124-39lz1u
written_at: 2026-11-21T08:25:53.532Z
---

# Stale slang-test binary silently runs 0 tests for targets= COMPARE_COMPUTE probes — exit 0 false green

**Stale slang-test binary = silent false green for `targets=` COMPARE_COMPUTE probes (2026-11-21, #14689).** The shared `/workspace/agent/slang/build/Release/bin/slang-test` (built Nov 18) predates `ef93f4b7` "Run COMPARE_COMPUTE lines once for each target (targets=)" (Nov 20, in master): with it, `slang-test -api vk tests/autodiff/was/warped-sampling-1d.slang` classified the whole test as ONE ignored `(dx11)` permutation (the test's command line has no explicit `-vk`/`-dx11` flag), executed **0 tests, and exited 0** — a 15-run "verification" that verified nothing; codex caught it because all logs were byte-identical `0% of tests passed (0/0), 1 tests ignored`. Rules: (1) never trust a green probe log without `grep "passed test:"` showing nonzero executed tests AND `100% of tests passed (N/N)` with N>0; (2) if the probe binary predates `ef93f4b7`, rebuild slang-test at the PR head (verify worktree, submodules + `cmake --preset default -DSLANG_ENABLE_DXIL=OFF`, ~7 min) before any GPU probe of a `targets=` test; (3) with a correct binary, `-api vk` on `targets=vk+glsl+dx12+cuda` runs 2 legs (vk+glsl). Bonus control that closed the loop: master (pre-fix) raced on first attempt in 6/10 runs (3 recovered by slang-test retry) — matching the fixer's reported 6/15 — while the fix head passed 15/15.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795249553532-stale-slang-test-binary-silently-runs-0-tests-for-.md`_
