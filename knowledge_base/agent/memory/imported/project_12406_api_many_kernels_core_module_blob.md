---
name: project_12406_api_many_kernels_core_module_blob
description: "#12406 api_many_kernels v2026.5→v2026.7 perf regression — TRIAGED, durable half = core-module blob growth = same defect as #12113; bisect IN FLIGHT with slang-fixer, RESUME on its byte count"
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12406-2026-08-06
---

**shader-slang/slang#12406** (opened 2026-08-06 by `nv-slang-bot[bot]` = our slang-discord-support, off a `rummyinyourtummy` report in Discord #slang-discussion). Open, 2 comments, no assignee, labels `regression`+`reproduced`, Type=Performance.

## Verdict (slang-triager, from real `bench.py` output — not the report's chart pixels)
**ONE issue, not two. Bisect first, NOT ready-for-fix.** high / P1, subsystem = modules + core-module serialization.
- `apiGetCode` **10.00× → 1.03×** — spikes at v2026.7, **fully recovers**. The +400% headline is a solved problem; chasing it is the rejected approach.
- `apiLoadModule` **1.66× → 1.60×** — the durable residual. Report said +20–29%; measured **+48–83%**.
- Third permanently-regressed phase the report structurally could not see: `apiCreateGlobalSession` **4.22× → 3.11×**. `api_many_kernels` declares `primary_timers=[apiTotal, apiLoadModule, apiGetCode]` (`lib/manifest.py:168`) ⇒ **the phase table is NOT a partition**; a reader expecting rows to sum is defeated by the artifact.
- ⛔**Recovery is NOT #11779** (`22d276460`): verified `behind` **both** v2026.12 and v2026.12.2, `ahead` v2026.13 ⇒ first ships v2026.13, but recovery was already ~83% done at v2026.12. A subagent asserted this confidently; a predictive test killed it. Recovery landed v2026.8..v2026.12, **cause unidentified**.

## Mechanism (verified at source, corroborated by 4 independent instruments)
Embedded core-module blob grew and never shrank. AST deserialization is lazy, but **IR deserialization is EAGER** — `readSerializedModuleIR_` allocates every inst up front (`slang-serialize-ir.cpp:587`), reached from `slang-global-session.cpp:712` ⇒ paid in full at **every `createGlobalSession`**, as both time and RSS. Core-module *source* **shrank 71 lines** across the window ⇒ not "more stdlib source"; something changed how much IR each decl serializes to.

⭐**Scope correction:** it is **per `createGlobalSession`**, NOT per process. A fresh `ISession` does not re-pay it — `IGlobalSession`'s own doc in `include/slang.h` says a global session is reused "to amortize startups costs (… mostly the cost of loading the Slang standard library)".

## The numbers, BYTES-FIRST (the only safe form — see the unit lessons below)
| tag | `_ZL12g_coreModule` (bytes) | MiB |
|---|---|---|
| v2026.5 | 4,959,750 | 4.73 |
| **v2026.5.2** | **4,964,785** | 4.73 ← ⚠️**+5,035 B, NOT byte-identical to v2026.5**; 46 commits between them |
| v2026.7 | 9,741,699 | 9.29 |
| v2026.14 | ~10,695,475 | 10.20 |
| local Release @HEAD | 10,703,926 | 10.2081 |

Step = **1.9642×** measured **v2026.5 → v2026.7** (9,741,699 / 4,959,750). ⚠️**From the tag the bisect actually anchors on, v2026.5.2 → v2026.7, it is 1.9622×** (9,741,699 / 4,964,785). ⭐**Never quote `1.964×` beside the v2026.5.2 byte figure — a ratio is a claim about two SPECIFIC operands and travels without them.** Prefer the absolutes; let the reader divide.

Secondary instrument `.rodata` on `libslang-compiler.so` = 7.62 → 12.23 **MiB** (1.605×). Deltas **+4.56 vs +4.61 MiB agree within 1.08%** — two libraries, two instruments, one cause. ⭐**A section ratio ALWAYS understates a symbol ratio** because the section carries unrelated read-only data; never quote them as competing figures for "the growth".

## ⚠️#12113 IS NOT DORMANT — a live prototype is being built against a claim this bisect can refute
The issue's *metadata* is stale (last updated 07-16) but its **thread carries a working prototype** by the assignee. Published there (verified by me 08-06 in the comment bodies):
> *"the eagerly-deserialized autodiff content accounts for essentially the **entire** v2026.5 → v2026.7 doubling … Approach (A) 'lazy-load what the core module serializes' was the right layer."*

Evidence for it: a prototype splitting the autodiff supplement out returns global-session RSS to the **pre-regression floor** (~100.0 MiB vs v2026.5 ≈ 101 MiB macOS / 96.7 MiB Linux). Thread is parked *"fix-in-progress, watching for the PR (`Fixes #12113`)"*.

⇒ **Two cases for the bisect result, both worth reporting explicitly:**
1. lands on `45ccce9a3` with ≥6.4× extra expansion concentrated on annotated decls ⇒ **independent confirmation from a different metric** (blob bytes vs RSS floor) — converts "the floor returns" into "and here is the commit".
2. lands elsewhere, or shows a **gradual climb** ⇒ "essentially the entire doubling" is **too strong** and an autodiff-only fix leaves a residual. **Quantify it**: *"autodiff accounts for X of the 4.78 MB; the rest is Y"* — that is the number the prototype's author cannot get from an RSS floor.

⛔**Case 2 does NOT contradict the prototype's measurement.** Two different quantities: **what is IN the blob** (our metric) vs **what is DESERIALIZED EAGERLY** (theirs). A lazy-load can return the RSS floor even if autodiff is not the sole blob contributor. Say so in any report, or a gradual-climb result gets misread as "the prototype doesn't work".

## DEDUP — the structural finding
**#12113** ("Peak memory for a minimal compile doubled ~100→~210 MiB between v2026.5 and v2026.7", OPEN, assignee **jvepsalainen-nv**, *stale since 2026-07-16*) is almost certainly **the same defect measured as memory instead of time** — same window, same shape, its body already says "dominated by createGlobalSession + core-module load". Triager **replicated it on Linux** (89→187→199 MiB; filed from macOS). Cross-reference IS registered on #12113's timeline.
**NOT a dup of #12139** — independently re-derived twice: `c8d02ae59` is **589 commits behind v2026.7**, so #12139's `SubstitutionCache` mechanism cannot reach April. See [[project_12139_shallow_generic_compile_regression_12106]].
⭐⭐**The durable half was found by a dedup query on the PHASE name, not the workload name.** `api_many_kernels in:body` → 3 hits, all good, and **silently excluded #12113**; `apiLoadModule in:body` → 5, surfacing a sibling the triager had itself triaged 3 weeks earlier. **A query encoding the reporter's vocabulary hides its own narrowness in its result.**

## Window + the instrument for the bisect
Growth landed **v2026.5.2 (03-31) → v2026.7 (04-21)** = **105 commits** (not 151 for v2026.5→v2026.7); narrowing holds on the primary instrument alone. **v2026.6 never existed** (404) — the release-axis gap is not missing data.
**Proxy bisect, no benchmark and no GPU:** blob size per build. ⚠️Symbol is **`_ZL12g_coreModule`** (C++ internal linkage) and official binaries carry an LTO suffix local builds lack — a probe for bare `g_coreModule` returns **PROBE_FAILED on all 8 tags with a passing must-fail control**, i.e. reads exactly like absence. Match wide, print hits, never trust a count. Cheaper still (slang-fixer): count `0x` elements in `build/source/slang-core-module/slang-core-module-generated.h` — it *is* the array initializer, exact to the byte, and validates 4 ways incl. the blob's own RIFF header (`chunk == count − 8`) as a free per-read control.
⛔`slang-core-module-without-timestamp.bin` exists **only on master** — keying the metric to that filename reads a **stale leftover** at every bisect step: wrong answer, no error signal, looks like a clean gradual climb.

## Candidates — do NOT pre-commit to #9808
`45ccce9a3` "#9808 Refactor auto-diff implementation" (04-01, idx **15 of 105**) is the prime suspect and confirmed in-window, but **hypothesis only**. Live alternates from the fixer's mechanism survey: **#10748** (`IHasDiffTypeInfo`→`__hasDiffTypeInfo` constraint/witness, idx 36), **#10719** (`OpCompilerDictionary`, idx 28), **#10736** (`Conditional<>` as intrinsic, idx 22), **#10643/#10711/#10723** (CoopMat/CoopVec IR insts).
⚠️`IHasDiffTypeInfo` measures **0 in `core.meta.slang` at BOTH tags** ⇒ **a zero source-count is NOT exoneration** — if #10748 is guilty the mechanism is witness logic changing how much IR existing decls serialize to, same class as "source shrank 71 lines yet blob doubled".
⚠️**Test step-vs-gradual explicitly.** One 4.73→9.29 step across the window *suggests* a single dominant commit, but no in-window commit has been measured. A gradual climb refutes the single-culprit framing and is a **finding, not a failed bisect**.

## ✅BISECT COMPLETE — COMMIT NAMED (slang-fixer, 4 probes vs 7-build budget, 2026-08-06)
**`45ccce9a376d48a7342615afb607d865cf973092` — "Refactor auto-diff implementation." (#9808), 2026-04-01.** SINGLE STEP.

| idx | commit | `_ZL12g_coreModule` bytes | verdict |
|---|---|---|---|
| 0 = v2026.5.2 | `80b74a9f33` | **4,964,785** | PRE — **byte-exact vs official (0 B)** |
| 13 | `c739e04679` | 4,967,205 | PRE (+2,420 B) |
| **15** | **`45ccce9a37` (#9808)** | **9,736,089** | **POST ← BOUNDARY** |
| 26 | `4c02a7b89a` | 9,743,408 | POST |
| 52 | `a66c8acb1e` | 9,741,501 | POST |
| — | official v2026.7 | 9,741,699 | (+198 B over idx52) |

**Boundary delta = +4,768,884 B = 99.83% of the total growth.** idx14 needed no build (one file, `.github/workflows/populate-sccache.yml`, cannot touch the blob). Gradual REFUTED at **198×**: a k=10 climb predicts ~478,000 B at idx13; measured +2,420 B.
⚠️**TWO CORRECT TOTALS, DIFFERENT SPANS — name the endpoints or you will "correct" a right figure:**
- **4,776,716** = `9,741,501 − 4,964,785` — floor → **idx52**, the probed span (the triager's table ends here).
- **4,776,914** = `9,741,699 − 4,964,785` — floor → **official v2026.7**. The 198 B between them IS the idx52→official hop.

⛔**I (Main) told the triager its 4,776,716 was "198 B low". IT WAS NOT — I assumed an endpoint its table never claimed.** That is a **false correction of a correct figure**, the exact failure I had flagged in slang-fixer two hours earlier ([[feedback_praising_self_correction_breeds_false_retractions]] (shared: `1786050943411-praising-self-correction-breeds-false-retractions-`)). Root cause on its side: prose saying *"equals the independently-computed endpoint difference"* **without naming which endpoints**, one sentence before introducing 9,741,699.
⭐⭐⭐**A SUM IS A CLAIM ABOUT A SPECIFIC SPAN — a partition total is meaningless without its endpoints named inline.** `9,741,501 − 4,964,785` is reader-checkable; "equals the endpoint difference" is unverifiable prose. Exactly parallel to *a ratio is a claim about two specific operands* and *a count without its denominator*. ⭐⭐**Same disease, three surfaces: ratios, counts, sums.**
⭐⭐**A telescoping sum CANNOT validate itself — only the independent endpoint difference can.** Both of us published broken segment walks in opposite directions (I merged idx26→idx52→official into one −1,709 hop; it wrote −1,907 as the *last* delta when +198 follows).

⛔**MECHANISM IS NOT ESTABLISHED — the commit is.** #9808 is a **238**-file refactor (`--shortstat`, 0 renames; Main said 239). Of **112** files it touches under `source/`, only **18 (16%)** are autodiff-named — the other 94 are AST/type-system (`slang-ast-builder`, `slang-ast-decl-ref`, `slang-ast-type`). ⭐That framing — *"autodiff is a minority of the touched compiler surface"* — is what blocks the inference; a bare file count does not. (A raw grep says 112 autodiff-named, but **94 of those are `tests/autodiff/**`** — split the aperture.)
**The ≥6.4× concentration criterion is DEAD, not merely limited:** 4,768,884 B is **0.96×** baseline over all meta source (distributed) but **6.40×** over `core`+`diff` only (concentrated) — the same total sits on BOTH sides of the threshold, and the bisect cannot supply the denominator.

**BOTH attribution paths TRIED AND DECLINED — do not retry:**
1. ⛔`slangc -dump-module` **cannot read this artifact**: it expects ONE serialized module, the core-module blob is a multi-module container (`Scon`/`Shea` chunks). Fails **silently** — exit 1, zero bytes on stdout AND stderr — at `slang-options.cpp:3375`, because diagnostics print only when non-null and a failed container load leaves them null. **That is a genuine upstream defect worth filing separately** (fix: diagnose unconditionally on the failure path).
2. ⛔Per-module dumps are **not buildable**: `meta.slang` goes through `slang-generate` first (`source/slang-core-module/CMakeLists.txt:44`), carries `$(...)` splices needing generate-time eval (441 in `core`, 17 in `diff`), and the files are **not independent TUs** (`diff` references `IDifferentiable`/`IFloat`/`DifferentialPair` from `core`). Not a 45-min build — constructing a compilation mode the project lacks.
⇒ ⭐**The party who can answer it cheaply is #12136's author**, whose prototype already splits the autodiff supplement out and can measure the blob with/without it in ONE build. We supply the commit; their prototype supplies the attribution.

**Live prototype PR (watch these, not the issue):** **#12136 "Load autodiff builtins on demand"** = the `Fixes #12113` candidate, **open, non-draft**, untouched ~30 h as of 08-06 20:00Z; also #12125 (compile-perf RSS tracking). ⚠️**#12113 the ISSUE looks dormant (last updated 07-16) because the work moved to the PR** — never read issue metadata as project state when a PR exists. ⇒ `-dump-module` residual follow-up is **live in case 1** while #12136 is open.

## ✅TERMINAL — MECHANISM CONFIRMED BY MAINTAINER, CHAIN CLOSED (2026-08-13/14)
The chain re-opened on two substantive human comments from **jvepsalainen-nv** (the #12113 assignee), then closed again. **The mechanism question we left explicitly open is now ANSWERED — by exactly the party we routed it to (#12136's author), from their own prototype in one build, as predicted.**
- **cmt 5279312785** — A/B of the two on-demand PRs: **#12136 "load autodiff builtins on demand" alone → session-create 0.53×, RSS 0.58× (−87 MB)**; #12136 **+ #12446** ("on-demand IR for builtin modules") together close **ALL** the memory regression (RSS 70.6 MB, *17% below* v2026.5 → **answers #12113 outright**) and **19%** of the wall-time residual (the session-create share). Wins compose, not overlap. So autodiff eager-loading **is** the driver — the attribution the bisect couldn't supply.
- Residual splits **55% `apiLoadModule` / 27% `apiGetCode` / 19% createGlobalSession**; the PRs close only the 19%.
- **cmt 5281597442** — root-causes the 55%: **nothing is cached across modules.** Inheritance/overload/substitution caches live on a **per-TU `SharedSemanticsContext`** (stack local in `checkTranslationUnit`, `slang-check.cpp:187`; `m_mapDeclRefToInheritanceInfo` `slang-check-impl.h:1224` — I verified both at master). Decisive: **100 byte-identical modules cost the same as 100 distinct** (+233.9 vs +241.6 ms), marginal cost flat at 2.69 ms/module. A hoist-to-`Linkage` prototype gets 0.64× but is **NOT sound** (2 documented correctness failures — conformance leaks across modules; absence-of-conformance is import-graph-dependent and un-keyable).
- ⚠️**Maintainer partially REVISED the #12139 framing: the `SubstitutionCache` cost largely falls out of the SAME per-TU→linkage scoping fix (406→41 ms), "not an independent problem."** #12458 (overload resolution) stays the genuinely-separate sibling — same entry point, different bottleneck (`isSubClassOf` call volume vs inheritance-info setup); fixing one won't move the other.
- Next ceiling: after the per-module fix, IR-gen is 89% of module load; `visitInterfaceDecl` (60%) **won't yield to the same technique** — lowered values are `IRInst*` owned by a specific `IRModule`, unhoistable unlike linkage-owned semantic values.

**Triager patched cmt 5208223805 IN PLACE a 3rd time (2026-08-13T20:25:31Z, 9220→12560 chars, comment count 4, never stacked)** — dated NOTE block: maintainer's two comments = authoritative decomposition, ours = the triage that pointed there. Both caveats carried. Did NOT re-title issue metadata (maintainer-owned) and did NOT re-correct the +73%/createGlobalSession points (our comment already had +48–83% / 3.11× Linux; macOS figures fall inside → cross-platform confirmation).

⛔**HANDOFF BOUNCE (2026-08-13):** my re-drive of the 2nd maintainer comment to the triager bounced 2× on transient provider errors ([a2a-redrive]). Re-sent self-contained; triager confirmed it had already acted off the ORIGINAL (msg 36-era session) before the re-drive, so the bounce lost the report, not the instruction. **A bounced a2a handoff does NOT self-heal — re-drive or escalate; I re-drove.**

**OPEN with operator (unanswered):** whether to file the `-dump-module` silent-failure defect (path 1 above) as a **separate** issue. Genuine self-contained bug; filing a new public issue is outward-facing so I asked rather than assumed.

**Remaining work is ALL maintainer-owned:** land #12136 + #12446, the per-module scoping fix, #12458. Nothing for slang-fixer/slang-triager unless a fresh substantive human comment lands.

## RESUME (superseded by the TERMINAL block above — kept for the bisect mechanics)
**slang-fixer is mid-build on the v2026.5.2 pre-regression endpoint**, isolated clone `/workspace/agent/bisect-12406/slang` (its FS), decision rule pre-registered on disk in `measure.sh` before any number existed, gate = order-of-magnitude (**<6 MB pre / >8 MB post**; 6–8 MB genuine stop) — a ±0.2–0.5% band was demoted to informational because the sibling's `dot` patch alone perturbs the proxy **0.211%**, i.e. a benign edit could false-stop a healthy toolchain.
⇒ **A PRE reading (~4.96M) green-lights the bisect over 105 commits (~7 builds).** Then: slang-triager refreshes **cmt 5208223805 in place** (it is last commenter and holds it) — I do NOT post on its behalf. Fix itself is a **maintainer call**: making core-module IR deserialization lazy is architectural, high blast radius, and the natural owner is #12113's assignee.
⛔Discord follow-up is **impossible from our side** — reporter asked in read-only #slang-discussion, 0 pending summons. slang-discord-support's answer is drafted and post-ready pending a summon; **#12406 is the reporter's only public artifact**. Maintainer `kaizhang_52840` already posted the mitigation there (serialize modules to disk, load binary) — relay it as **opt-in and API-only**: `CompilerOptionName::UseUpToDateBinaryModule` (`include/slang.h:1182`, "API-only; no direct CLI flag"), deliberately excluded from the option hash (`slang-compiler-options.cpp:403-409`, issue #6557), and **default-false means a stale binary silently shadows newer source**.

Unit/verification lessons this chain generated: [[feedback_a_ratio_column_that_mixes_mib_and_mb]] (shared: `1786042148863-a-ratio-column-that-mixes-mib-and-mb-is-systematic`) (folded into the shared learning by me, since `/workspace/shared/` is `ro` on coworker mounts). Instrument context: [[technique_compile_perf_three_platforms_and_v_staleness]].
