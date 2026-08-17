---
title: "slang#12103 compile-perf depth-workload follow-up — hold for self-assigned owner, merge-blocked on #12086"
type: learning
topic: slang-compiler
source: learnings/1784056143534-slang-12103-compile-perf-depth-workload-follow-up-.md
---

# slang#12103 compile-perf depth-workload follow-up — hold for self-assigned owner, merge-blocked on #12086

**Issue:** shader-slang/slang#12103 — "compile-perf: add depth-axis workloads guarding the generic-nesting regressions of #12100". Test-infrastructure enhancement (NOT a compiler change).

**Verdict:** enhancement / test-infra / P2 / component tools/compile-perf. PARKED, NO fixer, held for the self-assigned owner. Chain closed.

**Two independent reasons NOT to dispatch a fixer (either alone suffices):**
1. **Self-filed + self-assigned** by jvepsalainen-nv (CONTRIBUTOR), who owns the whole stack: #12086 (compile-perf suite redesign PR) + #12100 (the exponential generic-nesting compiler regression) + #12103 (these guard workloads). Named in #12100's Test Plan as a planned follow-up. Matches the standing "no-autofixer on self-filed+self-assigned" principle.
2. **Hard merge-order block:** #12103 stacks explicitly on PR #12086, which is still OPEN (non-draft). #12086 rewrites `tools/compile-perf/lib/manifest.py` + `lib/workloads.py` — the SAME files #12103 edits — so #12103 must land AFTER it or conflict; #12086's schema could still shift in review.

**Verification wins worth reusing:**
- To confirm a merge-order dependency, list the blocking PR's files: `gh pr view <n> --json files --jq '.files[].path'`. #12086 touches manifest.py+workloads.py → dependency confirmed, not just asserted.
- compile-perf workload schema (manifest.py:28-78, WORKLOADS 86-531): `WorkloadSpec(name, bucket, gen, default_size, mode, extra_flags, primary_timers, sweep_sizes, ...)`. Generators = `gen_<name>(n) -> {filename: source}` in lib/workloads.py; bench.py auto-discovers via `[shader("compute")] computeMain` + `RWStructuredBuffer<float> outBuf`. **Invariant (manifest.py:539-541): `default_size` MUST be in `sweep_sizes`** unless the ladder is empty — validate any proposed workload against this before endorsing.
- The three #12086 workloads (generic_nesting / generic_nesting_eval / interface_depth) are ABSENT on master — only added by the open PR. Don't assume in-tree just because an issue references them.

**Triage value-add when you can't/shouldn't fix:** validate the design against the live schema (all 5 proposed workloads pass the default_size∈sweep_sizes check) and say so in the verdict. Turns a "held" verdict into an actionable green light for the owner instead of a bare park.

**Labels/Type:** none applied. It GUARDS regressions but isn't one → no `regression`; nothing to reproduce (infra) → no `reproduced`; internal test-infra, neither Bug nor user-facing Feature → Type left untouched. Author self-assigned already.

**RE-ENGAGE:** only if a human/maintainer comments asking the bot to implement, or #12086 merges AND the owner explicitly hands it off. Otherwise closed.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784056143534-slang-12103-compile-perf-depth-workload-follow-up-.md`_
