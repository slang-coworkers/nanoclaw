---
name: project_slangpy_1001_triager_memo_verbatim
description: "slangpy#1001 triage memo from slangpy-triager (2026-08-06), DISTILLED 2026-10-04 (was a 16KB verbatim copy). Keeps the HEAD-verified mechanism pointers, the cache-PR ordering, the A/B/C approach list (OUR synthesis, never the author's), the ownership census, and the searched-surface list for the never-written Solution section. Chain closure + slangtorch_library non-existence live in project_slangpy_1001_build_time_kernel_compilation_scrub."
resource: https://github.com/shader-slang/slangpy/issues/1001
metadata:
  node_type: memory
  type: project
---

# slangpy#1001 triager memo — distilled evidence

Peer-authored (`slangpy-triager`), received 2026-08-06; the public form is its delta comment
`5199057817` on the issue. Chain record, my independent replication and the corrections to my own
claims: [[project_slangpy_1001_build_time_kernel_compilation_scrub]]. The raw 202-line memo was
pruned 2026-10-04 — everything below is the part no other leaf holds.

⛔ **The A/B/C list below is our own synthesis dated 2026-08-06.** The author never wrote a Solution
list ([[feedback_body_ending_early_is_not_evidence_of_truncation]]); never present A/B/C as recovered.

## Mechanism at HEAD (main @ 507b4cf1) — why it is still relevant

- `calldata.py:509` `session.load_module_from_source(hash, code)` parses a freshly generated wrapper
  string every process. `module.py:84` `pipeline_cache` is a plain in-process dict (reset `:197`;
  read `calldata.py:495`, written `:529`/`:577`, read `dispatchdata.py:176`) — **no persistence**,
  every process starts cold.
- Both persistent caches are opt-in `std::optional`, no default: `device.h:157` module_cache_path,
  `:162` shader_cache_path, consumed `device.cpp:98-118`. (The standing bot comment's
  `device.cpp:363-364` pointer is wrong — those lines are shader-model/feature-query code.)
- **Path instability:** absolute include paths enter session_desc at `shader.cpp:434-435`, the digest
  is computed from it at `:532` (`getSessionDescDigest`), and becomes the cache dir at `:545`. No
  normalization anywhere ⇒ an include-path string change is a total module-cache miss (the
  sandboxed-test / per-invocation-build-dir case).
- No build-time flow exists (0 hits for `slangpy_library|build_kernels|precompile_kernels|aot_compile`
  in CMake/pyproject/setup/tools; live controls `shader_cache_path`, `1034` hit). The wheel ships
  `.slang` **source** (`pyproject.toml:57`).
- Magnitudes (3s/5s/25-75s, ~7 min on A40) are the **reporter's**, unverified. `benchmarks/ppisp/`
  measures steady state with warmup, so cold-start cost has no CI guard.

## Cache-PR record — ordering is the point

| PR | what it is | relation to #1001 |
|---|---|---|
| #561 (skallweitNV, 2025-10-10, f350d2c5) | LMDB impl of slang-rhi's `IPersistentCache` | 7.5 months **before** the issue; the issue critiques it |
| #1013 (tdavidovicNV, 2026-06-03) | honor `defer_target_compilation` (default True) | **defers** codegen, does not persist it |
| #1036 (skallweitNV, 2026-06-30, b4b9ddf5) | `CacheWriter` background write worker | write latency only; no path fix |
| #1034 | ships Slang's prebuilt **stdlib** in the wheel | not slangpy kernels |
| #509 (issue) / #637 (tests) | `.slang-module` **loading** | not compile-and-ship |
| #969 "Build optimization" | C++ precompiled headers for slangpy's own build | not GPU kernels — misleading title |

All 51 merged PRs since 2026-05-26 swept: **no PR proposes build-time wrapper compilation.**
Adjacent upstream: slang#9004 (`UseUpToDateBinaryModule` breaks precompiled-module loading — any
build-time flow hits it); slang#10065 (closed, deploy without source).

## Candidate approaches (our synthesis; for the owner to pick)

- **A — persist wrapper module + pipeline across processes** (`calldata.py:495-529`, `module.py:84`),
  keyed by the existing `hash`. Smallest blast radius; the key must be a **superset** of everything
  dispatch-time decisions depend on (under-keying is a correctness bug). Risk medium.
- **B — make the existing opt-in module cache hit** by normalizing/excluding include paths before the
  digest (`shader.cpp:434/532/545`). Upstream-Slang-gated: needs confirmation that
  `getSessionDescDigest` hashes the include strings. Risk medium-high.
- **C — true build-time flow** (the issue's actual ask). Blocked because the wrapper does not exist
  until the call is made ⇒ needs a call-site declaration mechanism the author never specified.

Recommended path: **none** — this is a roadmap decision, not a bug; picking one would manufacture the
maintainer's decision.

## Ownership census (2026-08-06)

The "reassign" sweep was 34 byte-identical comments (12 slangpy + 22 slang). #1001 was **never
assigned** (0 assign events) — the ask is first-time ownership. 39 open items touch mkeshavaNV:
**27** still assigned to him, **5** unowned (slangpy #1001, #510; slang #9004, #8527, #7209), #820/#821
already moved to ccummingsNV, slang#6664 missed by the sweep. Last authored slangpy commit
2026-04-07; `updated_at` churn was the sweep's own bot events
([[feedback_a_count_is_only_as_wide_as_its_querys_scope]]).

## Solution-list recovery: searched and absent

#1001 body/comments/timeline; #510 (only our bot's mention); all his slangpy+slang issues and ~60
org PRs; phrase searches ("shapes would be sufficient", "near-zero startup cost"); the slang
#6518-#6607 precompiled cluster; slang-torch tree/README; local docs and git history over all refs;
slangpy-samples. **Could not search:** his gists (401) — and slangpy Discussions are disabled (410),
so that surface cannot hold it. State both when publishing the negative.
