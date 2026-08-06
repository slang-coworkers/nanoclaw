---
name: project_slangpy_1001_triager_memo_verbatim
description: "VERBATIM 202-line triage memo from slangpy-triager for slangpy#1001 (received 2026-08-06). Holds the slangtorch_library non-existence evidence with controls, A/B/C candidate approaches (OUR synthesis, never the author's list), and searched-surface enumeration. Analysis chain: project_slangpy_1001_build_time_kernel_compilation_scrub."
metadata:
  node_type: memory
  type: project
---

# Verbatim triager memo — slangpy#1001

⚠️ **Received artifact, preserved unedited below.** Peer-authored (`slangpy-triager`), not my
measurement. My independent replication of its central negative is in
[[project_slangpy_1001_build_time_kernel_compilation_scrub]].
⛔ The A/B/C approach list inside is **our own synthesis dated 2026-08-06** — never present it as the
author's recovered design list.

---

##### Triage: shader-slang/slangpy#1001 — Move kernel compilation to build time
Date: 2026-08-06 | Category: enhancement (architecture/perf proposal) | Severity: medium | Priority: roadmap-decision | Layer: functional-API / build-system | Backend: CUDA-dominant, cross-backend mechanism | Upstream-Slang: partial (digest internals)

## Request context
Scrub requested by @jkiviluoto-nv, cmt 5195826585, 2026-08-05T18:41:23Z: assess relevance /
reassignment / closure, reason "Mukund (mkeshavaNV) won't be returning to this work for a while."

**A prior session already scrubbed and posted this issue** — `nv-slang-bot[bot]` cmt **5196939912**,
2026-08-05T20:24:53Z, 5753 chars, `updated_at == created_at` (never edited). The dispatch briefing
did not mention it (parent measured at ~18:5xZ, briefed ~4h later from a stale snapshot). So this
session's job = verify the standing verdict + post only the delta. NOT re-derive.

## Verified findings (all at main @ 507b4cf1, non-shallow clone, confirmed still live head)

### 1. "Reassignment" is the wrong verb — VERIFIED
`/issues/1001/timeline`: assigned+unassigned event count = **0**. `assignees: []`, `assignee: null`,
labels 0, milestone none. mkeshavaNV **authored** it (2026-05-26T11:12:33Z), never owned it.
Real ask = first-time ownership of unowned design work.

### 2. Body is INCOMPLETE, and "truncated" is the wrong word — CORRECTED
Ends at "Any of the following shapes would be sufficient:" + `\n\n`, then nothing (od -c confirmed).
- Body is **4127 bytes** vs GitHub's 65536-char limit ⇒ **no platform truncation occurred**.
- `lastEditedAt: null`, `userContentEdits.totalCount: 0` ⇒ never present in ANY stored revision.
⇒ Accurate claim: **the author never wrote the list**, not "the text was lost/truncated".
This matters: the ask is not "recover lost text" but "the design options were never recorded".

### 3. Still relevant — do NOT close. VERIFIED at HEAD, not just documentary
Mechanism intact, each pointer personally re-read at 507b4cf:
- `calldata.py:509` `session.load_module_from_source(hash, code)` — parses a freshly generated
  string every process.
- `module.py:84` `self.pipeline_cache: dict[str, Pipeline] = {}` — plain in-process dict, reset at
  `module.py:197`; read `calldata.py:495`, written `:529`/`:577`, read `dispatchdata.py:176`.
  grep for `pipeline_cache` shows **no persistence layer** ⇒ every new process starts cold.
- Both persistent caches are **opt-in**, `std::optional`, no default: `device.h:157` module_cache_path,
  `device.h:162` shader_cache_path; consumed `device.cpp:98-118`.
- **Path-instability critique is structurally sound at HEAD**: absolute include paths enter
  session_desc at `shader.cpp:434-435` (`add_include`), digest computed from it `shader.cpp:532`
  (`getSessionDescDigest`), digest becomes cache dir `shader.cpp:545` (`cache_path /= data->uid`).
  No normalization (`canonical|normalize|lexically_normal` → 0 hits). ⇒ include-path string change =
  new uid = total module-cache miss. Exactly the sandboxed-test / per-invocation-build-dir case.
- No build-time flow exists: `slangpy_library|slangtorch_library|build_kernels|precompile_kernels|
  ahead_of_time|aot_compile` → **0 files** in CMakeLists/pyproject/setup.py/tools/cmake.
  Wheel ships `.slang` **source** (`pyproject.toml:57`); zero `.slang-module` in-tree.
  Positive control for the grep: `shader_cache_path` found at device.cpp:106; issue-number control
  `1034` found in changelog:26 ⇒ the zeros are real absences, not dead greps.

### 4. Cache-PR record — no fix landed (ordering is the key point)
- **#561** "Add persistent cache implementation based on LMDB cache", skallweitNV, merged
  **2025-10-10** = **7.5 months BEFORE** the issue; SHA f350d2c5. Issue explicitly critiques it.
  Nuance: `IPersistentCache` is an upstream **slang-rhi** interface; #561 implements it over LMDB
  (`persistent_cache.h:20`).
- **#1036** "Add CacheWriter", skallweitNV, merged 2026-06-30 (after issue). Background worker moving
  cache **writes** off the foreground compile path; `cache_writer.h:16` "Background worker for
  best-effort cache write jobs". Grep of its diff for `absolute|path.*stab|normaliz` → **0 hits**.
  ⇒ write latency only. No build artifact, no path fix.
- **#1013** "Honor deferred target compilation option", **tdavidovicNV**, merged 2026-06-03 — the PR
  the briefing missed. Touches only calldata.py/dispatchdata.py; `calldata.py:513-514`
  `defer_target_compilation` default True. **Defers** codegen, does not persist/eliminate it.
- **#509 is an ISSUE, not a PR** (closed 2025-11-17) — `.slang-module` loading. **#637** test-only.
  Both are module *loading*, not compile-and-ship.
- **#1034** ships Slang's prebuilt **stdlib** into the wheel, NOT slangpy kernels. Not a fix.
- Independent sweep of all 51 merged PRs since 2026-05-26 + git log on the cache files → only
  b4b9ddf5 (#1036), 687386e3 (#1039 thread names), b4c153e4 (#1012 slang version). **No PR proposes
  build-time wrapper compilation.**
- Cross-refs: exactly one, #510 (an issue, not a PR), 2026-08-05T20:32:16Z. Zero linked PRs.

### 5. Magnitudes NOT verified — inherited caveat, retained
The 3s / 5s / 25-75s per-call-site and ~7-min aggregate figures are the reporter's, on a ~30-call-site
A40 workload. No A40 here, no equivalent workload. Confirming **mechanism, not magnitudes**.
In-tree `slangpy/benchmarks/ppisp/` compares slangpy vs slangtorch (landed #811) but measures
steady-state with `warmup_iterations` — it does **not** measure cold-start/compile cost, so the
issue's metric is structurally unmeasured in CI.

### 6. Ownership scope — briefing said 8, actual is much larger
Sweep was **34 byte-identical comments** (sha256 f5f9b89705dc, 184 chars, 18:40:15Z→18:41:35Z):
12 slangpy + 22 slang. **39 open items** touch mkeshavaNV: slangpy 12 issues + draft PR #904;
slang 23 issues + 3 draft PRs (80-161 days stale).
- Genuinely **unowned now: 5** — slangpy #1001, #510; slang #9004, #8527, #7209.
- Still assigned to him: **27**.
- Already moved to **ccummingsNV**: #820, #821 ⇒ the template reason is FALSE for those.
- Sweep **missed** slang #6664 (assigned to him, no comment).
- PR #904 `[DNS] Dev/mkeshava/benchmark test` VERIFIED: draft, empty body, last update 2026-05-18.
- Reachability is an assumption, not a fact: last authored slangpy commit **2026-04-07**, last real
  comment on an issue he owns (#899) **2026-03-30** ⇒ ~4 months silent. Today's timeline events are
  sweep-induced (`subscribed`/`mentioned`), not him engaging.

## Candidate approaches (for whoever owns it; NOT for this scrub to pick)
### A. Persist the generated wrapper module + pipeline across processes
- Where: `calldata.py:495-529` (pipeline_cache), `module.py:84`
- Delta: wrapper source + compiled pipeline keyed by the existing `hash`, stored on disk.
- Tradeoffs: smallest blast radius; cache-key granularity must be a **superset** of what
  dispatch-time decisions depend on (under-keying = correctness bug class).
- Risk: medium — key correctness is the whole game.
### B. Fix module-cache path instability so the existing opt-in cache actually hits
- Where: `shader.cpp:434-435` / `:532` / `:545`
- Delta: normalize/relativize include paths before the digest, or exclude them from it.
- Tradeoffs: makes an existing feature work rather than adding surface; needs Slang-side confirmation
  that `getSessionDescDigest` hashes the Include strings (NOT locally inspectable — external/ has no
  slang dir). **Upstream-Slang dependency.**
- Risk: medium-high — unverified digest internals.
### C. True build-time flow (`slangpy_library`), the issue's actual ask
- Where: new CMake/tooling surface; nothing exists today.
- Delta: enumerate call sites at build time, precompile, ship artifacts.
- Tradeoffs: matches slangtorch's near-zero startup; largest scope. Blocked by the fact that the
  wrapper **doesn't exist until the call is made** (loaded from an in-memory string,
  `calldata.py:509`) ⇒ needs a call-site declaration mechanism the author never wrote down (finding 2).
- Risk: high; genuinely needs the missing design.

## Recommended path
**None — decline to recommend, and that is the finding.** The issue is a roadmap question
("is this the direction we want?"), not a bug ("does it still reproduce?"). Approach C is what was
asked for but its design section was never written; A is the tractable subset; B is upstream-gated.
Picking one here would manufacture a decision in place of the maintainer's.
Concrete deliverable instead: **ask @mkeshavaNV to write the Solution list while any chance of
reaching him remains** — this is the only genuinely time-sensitive item, and it is NOT in the
standing comment.

## Delta to post (standing verdict is public and correct; do not re-litigate)
1. Solution list was never written (not truncated) — unrecoverable from GitHub; ask the author now.
2. Standing verdict re-verified at 507b4cf, still live head, unchanged.
3. Ownership scope: 39 items / 27 still-assigned / 5 unowned — one owner for one issue leaves the rest dark.
POST FRESH, do not PATCH: cmt 5196939912 belongs to a **sibling session** (its twin scrubbed #510 at
20:32:15Z with near-identical phrasing). Shared-store rule (slang#10181): never PATCH a sibling's
comment, reconcile in your own. Also GitHub notifies on create, never on edit — the actionable ask
must be delivered, and the chain has been idle since 20:24:53Z.

## Error found in the standing comment (do not repeat)
It cites `device.cpp:363-364` for shader_cache_path/module_cache_path. Those lines are shader-model /
feature-query code. Real sites: `device.h:157`/`:162` (decls), `device.cpp:98-118` (consumption).
Substance holds, pointer is wrong.

## Sources
- Timeline/comments: /issues/1001/timeline, /issues/1001/comments (ids 5195826585, 5196939912)
- GraphQL: userContentEdits.totalCount=0, lastEditedAt=null, bodyText 3963 bytes
- HEAD reads: calldata.py:495-529, module.py:84/197, shader.cpp:434-435/532/545, device.h:157-162,
  device.cpp:98-118, cache_writer.h:16, pyproject.toml:57
- PRs: #561 f350d2c5, #1036 b4b9ddf5, #1013, #1039 687386e3, #1012 b4c153e4, #1034 451327b2, #811
- Prior learnings: sibling-comment PATCH hazard (slang#10181), cache-key granularity lens,
  never-inherit-abandonment-premise (#820 → ccummingsNV)

## ADDENDUM 2026-08-06 — recovery hunt result + a new load-bearing finding

### Design list: NOT FOUND / NOT RECOVERABLE (experiment run before resorting to the ask)
Surfaces searched and absent: #1001 body/comments/timeline; the only cross-ref (#510) contains just
our own bot's passing mention, no quote; all mkeshavaNV slangpy + slang issues; ~60 of his org-wide
PRs; `commenter:mkeshavaNV` x {build time, precompiled}; org+global searches for
"shapes would be sufficient" / "first-class build-time" / "near-zero startup cost"; slang#9661
(UNRELATED — GetDimensions for CUDA, by skallweitNV, not build-time); the #6518-#6607 precompiled
cluster (cheneym2-authored SPIR-V/DXIL tests, no design shapes); slang-torch repo tree/README;
local docs/, .agents/, all *.md/*.rst; git history over all refs; slangpy-samples.
COULD NOT search: his gists (401, GitHub not connected); slangpy Discussions are DISABLED (HTTP 410)
so that surface cannot hold it. State both when publishing the negative.

### NEW, and sharper than the missing list: `slangtorch_library` DOES NOT EXIST
The reference design the entire issue is premised on ("analogous to `slangtorch_library`",
"built via `slangtorch_library` pays near-zero startup cost") is a name that exists **nowhere**:
- global code search: **0** hits; global issue search: **1** hit = #1001's own body.
- `git log --all -S'slangtorch_library'` over **1644** commits, all refs: **0**.
- **Controls prove the instruments were live** (a zero from a dead query is worthless):
  code `loadModule org:shader-slang` -> 654, `slangtorch org:shader-slang` -> 50;
  `git log --all -S'load_module_from_source'` -> 56 commits, `-S'pipeline_cache'` -> 10 commits.
  (First attempt at the git checks ran in /tmp and returned 0/0 — the control's 0 exposed the dead
  instrument. Re-ran inside the checkout. Record: a zero is only evidence with a live control.)
- What slangtorch really provides: public API is `loadModule, clearPersistentShaderCache,
  clearSessionShaderCache, clearShaderCaches` — no `*_library`. `slangc -target torch-binding` is
  real (`slangtorch/slangtorch.py:710`); building goes through torch's `cpp_extension`
  (`_write_ninja_file_and_build_library`, `slangtorch/util/compile.py:7,76,92,114`).
  `compileAndLoadModule` is **runtime JIT + persistent on-disk cache**, NOT a build-time rule.
  A real `slang_library` CMake fn exists but in shader-slang/**slang** for stdlib modules, unrelated.
- FACT: no public `slangtorch_library`. HYPOTHESIS (label as such): author's shorthand for the
  ninja/cpp_extension flow, or an internal NVIDIA-side CMake wrapper — which would explain a name
  spoken of as something a workload was "built via" yet public nowhere.
⇒ Consequence for the maintainer: the issue's own baseline is unverifiable as written. Whoever owns
  this must first establish what the comparison target actually was. This is a *better* question to
  put to the author than "finish your Solution section", and it is answerable by others too.

### Reconstruction: a maintainer does NOT need the author to proceed
Unsolved core is narrow and localized: per-call-site wrapper synthesised + parsed from an in-memory
string every process (`calldata.py:509`); `pipeline_cache` in-process dict, no persistence
(`module.py:84`). Approaches A/B fall straight out of that; only C (true build-time rule) genuinely
needs his input, since it requires a call-site declaration mechanism.
Adjacent upstream: **slang#9004** (his own, OPEN, unowned) — `UseUpToDateBinaryModule` breaks
precompiled-module loading, which any build-time flow would hit. slang#10065 (closed) = deploy
without source.
⚠️ The A/B/C list in this memo is **our own synthesis dated 2026-08-06**, NOT the author's text.
Never present it as the recovered list.

### Census independently replicated (12/12 slangpy identical) + hash reconciliation
My own sha256 pass over all 12 slangpy sweep comments: all identical. My prefix `f64d587ab745` vs the
earlier `f5f9b89705dc` — reconciled exactly: 184-byte body = f5f9b897, +jq trailing newline (185 B) =
f64d587a. Same conclusion, different extraction. ⇒ Publish "all byte-identical", NOT a hash prefix
that doesn't reproduce across instruments.
Body size pinned: **4054 chars** (4127 B w/ newline) = **6%** of GitHub's 65536-char limit.
slang#6664 sweep-miss CONFIRMED (assigned mkeshavaNV, open, zero jkiviluoto-nv comment) with a
positive control: its 1 comment is nv-slang-bot[bot] @20:38:17Z, so the query was live.
Note: sibling sessions are scrubbing this cluster concurrently (#510 @20:32:15Z, #6664 @20:38:17Z).

### Correction to my own earlier note
I flagged the standing comment's `device.cpp:363-364` as wrong (it is — those lines are shader-model /
feature-query code; real sites `device.h:157`/`:162`, `device.cpp:98-118`). Substance unaffected.
Also checked: #969 "Build optimization" is C++ **precompiled headers** (SlangPy's own build speed),
NOT GPU kernel compilation — a title that invites exactly the wrong inference.
