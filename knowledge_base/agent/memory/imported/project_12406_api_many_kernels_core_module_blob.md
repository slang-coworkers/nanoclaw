---
name: project_12406_api_many_kernels_core_module_blob
description: "#12406 api_many_kernels v2026.5→v2026.7 perf regression — CLOSED-completed 2026-09-14. Bisect named #9808 (45ccce9a3) as the single commit that doubled the embedded core-module blob; maintainer confirmed autodiff eager-loading as the driver and root-caused the wall-time residual to per-TU SharedSemanticsContext cache scoping. Fix landed via #12574 + #12616 (per-module) and #12877 (#12139), NOT the #12136/#12446 prototypes tracked. Distilled from the in-flight snapshot during okf-synthesis."
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12406-2026-08-06
---

# shader-slang/slang#12406 — api_many_kernels v2026.5→v2026.7 perf regression (CLOSED)

Opened 2026-08-06 by our slang-discord-support (`nv-slang-bot`) off a `rummyinyourtummy` #slang-discussion
report; `regression`+`reproduced`, Type=Performance. **CLOSED-completed 2026-09-14** by jvepsalainen-nv
("Related PRs are merged. Closing this issue."). Distilled from the 2026-08-06 bisect-in-flight snapshot
during okf-synthesis; the bisect mechanics are archived below in one paragraph.

## Terminal outcome (2026-09-14)
- **Bisect named `45ccce9a376d48a7342615afb607d865cf973092` — "#9808 Refactor auto-diff implementation"
  (2026-04-01)** as the single commit growing the embedded core-module blob 4,964,785 → 9,736,089 B
  (+4,768,884 = **99.83%** of total growth, ONE step; gradual refuted 198×). 4 probes / 7-build budget.
- **Maintainer confirmed the mechanism = autodiff eager-loading** (prototype A/B), then root-caused the
  per-module wall-time residual to per-TU `SharedSemanticsContext` cache scoping (nothing cached across
  modules).
- ⛔ **The fix did NOT land via the #12136/#12446 prototypes we tracked — those are STILL OPEN, superseded.**
  Verified merged fixes: **#12574** ("prelink supply imported interfaces instead of re-deriving them",
  per-module, 09-01) + **#12616** (type-flow sets, 09-01); **#12877** ("Fix #12139…", 09-03).
- ⚠️ **Issue-state corrections (triager-verified):** #12139 and #12113 are BOTH still OPEN — #12877 merged
  but carries no auto-close keyword so #12139's *issue* stays open (its fix landed); #12113 is genuinely
  unresolved because its intended closers are #12136/#12446, which never merged. Branch attribution:
  #12136 is on `issue-12113-lazy-autodiff-builtins`, only #12446 on `jvepsalainen/on-demand-ir-exploration`.
  #12139 got a DEDICATED PR (#12877), NOT "subsumed by the same per-TU→linkage scoping fix" as the
  maintainer's 08-13 comment and my note both predicted — correct the record.
- **Open with operator (unanswered):** whether to file the `-dump-module` silent-failure defect (below) as a
  separate issue. Remaining work is all maintainer-owned; nothing for the fixer/triager unless a fresh
  substantive human comment lands.

## Triage verdict (from real `bench.py` output, not report chart pixels)
**ONE issue, not two. Bisect first, NOT ready-for-fix.** high / P1, subsystem = modules + core-module
serialization.
- `apiGetCode` **10.00× → 1.03×** — spikes at v2026.7, **fully recovers** (the +400% headline is solved;
  chasing it was the rejected approach).
- `apiLoadModule` **1.66× → 1.60×** — the durable residual (report said +20–29%; measured **+48–83%**).
- `apiCreateGlobalSession` **4.22× → 3.11×** — a third permanently-regressed phase the report structurally
  could not see: `api_many_kernels` declares `primary_timers=[apiTotal, apiLoadModule, apiGetCode]`
  (`lib/manifest.py:168`) ⇒ **the phase table is NOT a partition**; a reader expecting rows to sum is
  defeated by the artifact.
- Recovery landed v2026.8..v2026.12, cause unidentified; it is **NOT #11779** (verified `behind` both
  v2026.12 and v2026.12.2) — a subagent asserted this confidently, a predictive test killed it.

## Mechanism (verified at source; maintainer-confirmed decomposition)
Embedded core-module blob grew and never shrank. AST deserialization is lazy, but **IR deserialization is
EAGER** — `readSerializedModuleIR_` allocates every inst up front (`slang-serialize-ir.cpp:587`), reached
from `slang-global-session.cpp:712` ⇒ paid in full at **every `createGlobalSession`** (NOT per process; a
fresh `ISession` does not re-pay it). Core-module *source* shrank 71 lines across the window ⇒ not "more
stdlib source"; #9808 changed how much IR each decl serializes to.

Maintainer decomposition (comments 5279312785 / 5281597442): **#12136 alone → session-create 0.53×, RSS
0.58×; #12136 + #12446 close ALL the memory regression** (RSS 70.6 MB, 17% below v2026.5 → answers #12113
outright) and **19%** of the wall-time residual (the createGlobalSession share). So autodiff eager-loading
**is** the driver — the attribution the bisect couldn't supply. Residual splits **55% apiLoadModule / 27%
apiGetCode / 19% createGlobalSession**; the 55% root cause is **nothing cached across modules** — inheritance/
overload/substitution caches live on a per-TU `SharedSemanticsContext` (`slang-check.cpp:187`;
`m_mapDeclRefToInheritanceInfo` `slang-check-impl.h:1224`). Decisive: 100 byte-identical modules cost the
same as 100 distinct (flat 2.69 ms/module). A hoist-to-`Linkage` prototype gets 0.64× but is NOT sound
(conformance leaks across modules). #12139's `SubstitutionCache` cost largely falls out of the same per-TU→
linkage scoping fix; #12458 (overload resolution) stays the genuinely-separate sibling.

## Durable method lessons (the reusable half)
- ⭐⭐ **The durable dedup was found by querying the PHASE name, not the workload name.** `api_many_kernels
  in:body` → 3 hits, all good, silently excluded #12113; `apiLoadModule in:body` surfaced the sibling.
  **A query encoding the reporter's vocabulary hides its own narrowness in its result.** (#12113 = the same
  defect measured as memory not time; NOT a dup of #12139 — `c8d02ae59` is 589 commits behind v2026.7.
  See [[project_12139_shallow_generic_compile_regression_12106]].)
- ⭐⭐⭐ **A sum/ratio/count is a claim about a specific span/operands/denominator — name them inline or a
  reader "corrects" a correct figure.** I (Main) told the triager its 4,776,716 B was "198 B low"; it was
  NOT — I assumed an endpoint (official v2026.7) its table never claimed (it ended at idx52). A telescoping
  sum cannot validate itself; only the independent endpoint difference can. (Same disease, three surfaces:
  ratios, counts, sums. Cf. [[feedback_praising_self_correction_breeds_false_retractions]] shared
  `1786050943411-praising-self-correction-breeds-false-retractions-`.)
- ⛔ **The commit is established; the *mechanism* was not, from the bisect alone.** #9808 is a 238-file
  refactor; of 112 files under `source/`, only 18 (16%) are autodiff-named. The same +4,768,884 B is 0.96×
  baseline over all meta source (distributed) but 6.40× over `core`+`diff` only (concentrated) — sits on
  BOTH sides of any concentration threshold; the bisect cannot supply the denominator. Route mechanism to
  the party whose prototype can measure it in one build (#12136's author) — which is exactly what answered it.
- ⛔ **`slangc -dump-module` cannot read the core-module blob** — it expects ONE serialized module; the blob
  is a multi-module container (`Scon`/`Shea` chunks) and it fails **silently** (exit 1, zero bytes on stdout
  AND stderr) at `slang-options.cpp:3375` because diagnostics print only when non-null. **Genuine upstream
  defect worth filing** (fix: diagnose unconditionally on the failure path). Per-module dumps aren't
  buildable either (`$(...)` splices need generate-time eval; `diff` isn't an independent TU).
- ⭐ **A human's "PRs merged" is a claim to VERIFY (`.merged` per PR), not relay** — true in substance,
  wrong in the specific numbers this chain tracked. Same discipline caught my own branch/issue-state slips.
- **Never read issue metadata as project state when a PR exists** — #12113 looked dormant (updated 07-16)
  because the work moved to the PR.
- **Bisect instrument (archived):** proxy = `_ZL12g_coreModule` blob bytes per build (C++ internal linkage;
  official binaries carry an LTO suffix, so a bare `g_coreModule` probe reads as absence — match wide, print
  hits, never trust a count); cheaper still, count `0x` elements in `slang-core-module-generated.h` with the
  blob's RIFF header (`chunk == count − 8`) as a free per-read control. `slang-core-module-without-timestamp.bin`
  exists only on master — keying the metric to it reads a stale leftover at every step.

**Mitigation relayed to the reporter** (maintainer `kaizhang_52840` posted it): serialize modules to disk,
load binary — but **opt-in and API-only**: `CompilerOptionName::UseUpToDateBinaryModule` (`include/slang.h:1182`,
no CLI flag), excluded from the option hash (issue #6557), and **default-false means a stale binary silently
shadows newer source**.

Unit/verification lessons this chain generated: [[feedback_a_ratio_column_that_mixes_mib_and_mb]] (shared
`1786042148863-a-ratio-column-that-mixes-mib-and-mb-is-systematic`); instrument context
[[technique_compile_perf_three_platforms_and_v_staleness]].
