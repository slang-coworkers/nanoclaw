---
name: project_12337_backend_codegen_compile_time_pattern
description: "#12337 backend-codegen compile-time pattern report (3 Discord users, repro pending) — own-bot-filed echo, NO triage/fixer dispatch (its own gate is a maintainer's repro request). ONE substantive finding of mine: the FENCED memory hypothesis is NOT an unverified one-off — it lands in the range of #12113's reproduced+root-caused session floor, whose prototype fix PR #12136 is OPEN/dirty/19d stale; #12113 and #12112 are BOTH ABSENT from the issue's dedup list"
metadata:
  node_type: memory
  type: project
  originSessionId: sess-1785838009652-qbyodo
---

# #12337 — backend-codegen compile time (pattern report)

**shader-slang/slang#12337**, "Backend-codegen compile time: three independent user reports in four days,
all backend-bound (pattern report; repro pending)". Filed **2026-08-04 10:06:47Z by `nv-slang-bot[bot]`**
= **slang-triager** session `sess-1785837557910-nwwnel`, thread `gh-issue-shader-slang/slang-backend-codegen-perf`,
on a 09:59Z filing request from **slang-discord-support** (routed there because both those edges read
`permissions.push=false` / `gh api user` 403 — a signal the triager then learned does **NOT** measure
`issues:write`, see its 10:08Z learning). State at first look: OPEN, **0 comments**, **no labels**,
**Type = Performance** (already correct), no assignee. Canonical thread now
`gh-issue-shader-slang/slang-12337`.

Reported signal: `codingdaniel` (~40 s cold compile, few-hundred-MB session memory, **already built module
IR caching himself and it did not help**), `h7per` (80 ms vs 120 ms vs glslang), `jaspersgames` (independently
advising a DIY SPIR-V cache). Its own stated gate: **wait for the reproducer** `sbangaru_nv` asked
`codingdaniel` for on 2026-08-03 23:40Z. That gate is a maintainer's to close.

## Routing decision — NO dispatch (own-bot echo), but ONE additive finding

Same class as [[project_12320_coverage_macos_segfault_base_rate]] / [[project_12321_bfloat16_vector_vulkan_wrong_lanes]]:
a bot-filed `issue_opened` webhook echoing our own chain's artifact. **Re-triaging the triager's own filing
minutes after it published is the echo trap.** No fixer either — the issue's own step 1 is "wait for the
reproducer", step 2 needs **no compiler change**. So: no triage dispatch, no fixer dispatch.

⭐ **But "own-bot echo" is a reason not to RE-DO the work, never a reason to withhold NEW verified content.**
I found one thing the filing does not contain, and it is cheap and load-bearing.

## The finding — the FENCED memory hypothesis already has a home, and it is not unverified

The issue fences `codingdaniel`'s few-hundred-MB session footprint as *"one unverified self-report"*,
recorded *"only so it is not lost if a second reporter mentions it."* **The fence is the right instinct and
the wrong status.** That number lands squarely in the range of an already-**reproduced, root-caused,
prototype-fixed** measurement:

- **[#12113](project_12113_minimal_compile_peak_rss_doubled.md)** (OPEN, `regression`+`reproduced`,
  Type Performance, assignee **jvepsalainen-nv**) — peak RSS for a **minimal / empty** compile roughly
  doubled v2026.5 → v2026.7 and persists: **session floor ≈ 212 MiB macOS arm64 / ≈ 188 MiB Linux x86_64**,
  current master ≈ 220. Root cause **fully accounted for**: `createGlobalSession()` eagerly deserializes the
  whole embedded core module, whose blob (`g_coreModule`) went 4.73 → 9.29 MiB (×1.96, tracking the RSS
  ratio); the growth is **autodiff content**.
- **PR [#12136](https://github.com/shader-slang/slang/pull/12136)** "Load autodiff builtins on demand"
  (`Fixes #12113`) — owner's own fix. Prototype numbers: **207.5 MiB → 100.0 MiB** global-session RSS
  (−51.8%) and **560.8 ms → 231.7 ms** session creation (−58.7%). ⚠️**OPEN, non-draft, but
  `mergeable_state=dirty` at head `04d908456991`, last touched 2026-07-16T15:14:26Z — 19 days stale.**

⛔ **This is NOT the "high memory + slow codegen must be related" pattern-match the issue rightly warns
against — it is the OPPOSITE move.** It gives the memory axis its own home so it stops looking like a loose
thread on the codegen claim. And it carries its own refutation of the tempting conflation: session creation
is **~0.5 s → ~0.23 s** in the prototype, so the session floor **cannot** explain a 40 s cold compile.
⭐ **De-coupling two axes STRENGTHENS a fence; merging them is what earns an undeserved diagnosis.**

⚠️ Honest limit on my own claim: `codingdaniel`'s figure is a **range match** ("few-hundred-MB" vs a
212–220 MiB measured floor), **not an identity** — his exact number and platform are unknown. State it as
a range match. That is still enough to move the datapoint from "unverified one-off" to "consistent with a
known measured floor", which is the whole of the claim.

## The dedup gap (verified, and it matters because the issue asserts dedup ran three times)

#12337 says dedup "was run independently twice … and re-derived a third time", and enumerates: front-end
**#12139, #12100, #11952, #9755, #11501**; checked-and-distinct **#11774, #9004**; closed prior art
**#595, #3413, #3529, #4726**.

✅ **`grep -c '12113\|12112'` over the issue body = 0.** Both are absent:

- **#12113** — the session-floor regression above (OPEN, reproduced, prototype PR in flight).
- **#12112** — "compile-perf: track memory footprint (peak RSS per workload, session-create delta)",
  OPEN, Type **Feature**, same owner. This is the *harness* side of exactly the axis #12337's fenced
  hypothesis needs.

Neither is a *compile-time* issue, so their absence from a compile-time enumeration is defensible —
**but #12337 raises a memory hypothesis in its own body and does not connect it to the two open memory
issues.** ⭐ **A dedup scope drawn for claim A does not cover the fenced hypothesis B you added later ⇒
when you fence a second axis, re-run dedup ON THAT AXIS.**

## What I verified myself at HEAD `0864e60e6` (the tree the issue cites)

The filing is well-built; I am adding, not correcting errors. All four of its file:line claims check out:

| claim | result |
|---|---|
| `tools/compile-perf/breakdown.py:56` `emitEntryPointsSourceFromIR` is a named bucket | ✅ present |
| `source/slang/slang-emit.cpp:2747` emit timer is `SLANG_PROFILE` | ✅ `SlangResult CodeGenContext::emitEntryPointsSourceFromIR` + `SLANG_PROFILE` |
| `source/core/slang-performance-profiler.cpp:10` flat dict keyed by func name, `enterFunction` at :12 | ✅ `OrderedDictionary<const char*, FuncProfileInfo> data;` then `enterFunction` |
| `include/slang.h:5441` `getEntryPointHash` self-documents as the backend-output cache key | ✅ verbatim |
| #12270 was a real key-collision bug in this area | ✅ CLOSED completed — `buildHash` ignored `intValue2` ⇒ shader-cache key could collide |

➕ **One point the issue understates, in its own favour:** session-create is **already a compile-perf
workload**, not just a possible one — `tools/compile-perf/lib/manifest.py:153-159` defines
`api_session_create` (`api_cmd="session-create"`, primary timers
`apiCreateGlobalSession` / `apiCreateSession` / `apiTotal`), and `breakdown.py:91` charts
`apiCreateGlobalSession`. So when the reproducer lands, the **same harness run measures BOTH axes** —
backend-codegen dominance *and* the session floor — with no code change. That makes its step 2 cheaper
than it claims.

## TERMINAL 2026-08-12 — maintainer closing per offline discussion

`kaizhangNV` (assignee + maintainer), cmt `5269617369`: *"We have discussed this offline, should
close this issue. Instead we should track specific perf bugs."* ✅ **This is the maintainer's
disposition to accept, not argue** — #12337 was self-described as a *pattern tracker, not a bug*, and
"track specific perf bugs" is exactly what the issue's own step 3 deferred to. **Nothing lost on
close:** the two findings (baseline asymmetry + the untimed spirv-opt gap,
[[project_12337_spirvopt_baseline_asymmetry]]) live on disk and can seed a specific bug later.
⛔ **No reopen, no counter-proposal, no injected backlog item** — shoving "here's a perf bug to
track" into a close request is the verbosity+overreach pattern
([[feedback_verbose_bot_comments_are_a_cost_we_impose]]). ⛔ Bot cannot `gh issue close`
(hook-denied) — it is `kaizhangNV`'s click. Acknowledged in one short comment; chain CLOSED on our
side. RESUME only if a **non-bot** reopens with new substance.

## Disposition (of the earlier dispatch, retained for trace)

**Dispatched to slang-triager** (closest-to-the-state: it filed the artifact and owns its dedup claim),
pinned via `target_session_id=sess-1785837557910-nwwnel` so it lands in the session holding the filing
context rather than minting a cold one. I dispatched **WHAT** (the three verified facts) and left placement,
wording and whether a note belongs on #12113/#12136 to it — per
[[feedback_approver_step1_clauses_are_data_only_judgment_is_step3]].
**I did NOT post myself** — [[feedback_dont_post_and_delegate_same_write]] (post-and-delegate = duplicate
`nv-slang-bot` comment).

**No label applied and none recommended.** Siblings #12100/#12113 carry `regression`+`reproduced` because
they reproduce; #12337 reproduces **nothing** and establishes **no regression**, so both labels would be
false. Type=Performance is already set. ⭐ **Matching a sibling's label set is not evidence the labels apply.**

**#12136's staleness is #12113's chain, not this one.** [[project_12113_minimal_compile_peak_rss_doubled]]
is PARKED with RESUME = *"re-engage only if jvepsalainen-nv requests fixer help"*, and a self-driving
owner's needs-rebase PR is his to rebase. What is genuinely **new** there is an external user datapoint
(a real user hitting the floor) where before there was only synthetic bench data — that is the triager's
call to surface, not mine to nudge on.

**RESUME on #12337:** the reproducer landing (then point `tools/compile-perf/` at it and publish the
`-report-perf-benchmark` breakdown — no compiler change), a substantive **non-bot** comment, or a
maintainer picking it up. ⛔ Do **NOT** re-triage on further bot echoes. ⛔ Do **NOT** let "three users in
four days" drive urgency past what one unreproduced pattern report supports.
