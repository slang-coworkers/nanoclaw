---
type: triage
---
# Triage: shader-slang/slang#14359 — Serialized module resolves relative dependency from wrong include root, changing entry-point hash
Date: 2026-11-05T20:45Z | bug | Severity: high (stale-binary wrong code reachable) | P2 | Component: modules (binary-module load / dependency resolution)
Reporter: ccummingsNV (MEMBER), full CMake+main.cpp repro. Not a regression (lookup order dates to #3614, 2024-02). Duplicate: no.

## What's broken
A `.slang-module` records non-primary file deps relative to the module's SOURCE dir (`../../build/common.slang`
from `prod/shaders/pkg/`). On reload, both `isBinaryModuleUpToDate` and `loadSerializedModuleContents` resolve each dep
FIRST via `loadSourceFile(<.slang-module path>, dep)` = `IncludeSystem::findFile` Quote mode: relative-to-cache-dir, then
EVERY search dir. Search root `shadow/pkg/shaders` + `../../build/common.slang` = `shadow/build/common.slang` hits before
the source-relative retry ever runs. Equal bytes -> freshness passes; module keeps the shadow identity; consumer that also
imports a source module including the real file gets two SourceFiles (4 -> 5 deps) -> `Module::computeDigest` changes.

## Repro (Linux, ToT 4a6758601; build/Release libslang-compiler built 18:05 from it; origin/master is +1 unrelated HLSL commit)
- `/workspace/agent/repro-14359/` — reporter's CMakeLists+main.cpp extracted verbatim from the issue; `-DSLANG_SDK_DIR=<slang>/build/Release`.
- control: cold=warm `8e4097870668f80a6f6d3d33c75f0b06f5e13195`, deps 4/4, warm dep = prod/build/common.slang.
- collision: cold `cc4d6616d11bece27db03245785a53b84b65d95e` != warm `c661a468cf709c8a179f8b23f95ca4888f4c22a3`; warm base dep
  = shadow/build/common.slang; consumer deps 4 cold / 5 warm (shadow + prod). Exit 0 "BUG REPRODUCED". (Hashes include abs prefix.)
- **Staleness variant** (`repro-14359/stale.cpp`, HLSL target): cold with shadow=old bytes (7), then edit prod common to 8.
  Control (no shadow): warm recompiles from source -> `return int(8)`. Collision: warm REUSES `base.slang-module`,
  emits `baseValue -> int(7)` while `supportValue -> int(800)` => silent stale wrong code. Worse than the reported hash drift.

## Codebase digest (ToT 4a6758601)
- `source/slang/slang-session.cpp:2147-2156` loadSourceFile -> IncludeSystem(searchDirs).findFile(path, pathFrom).
- `source/compiler-core/slang-include-system.cpp:92-139` findFile: absolute; Quote relative-to-includer; then every search dir.
  4-arg `findFile(SLANG_PATH_TYPE_FILE, from, path, out)` at :24 = single combined-path existence check, no search sweep.
- `slang-session.cpp:2159-2227` isBinaryModuleUpToDate: moduleSrcPath recovered :2180-2194; per dep attempt1 :2201 (fromPath),
  retry :2206-2207 (moduleSrcPath) only on miss; idx0 miss -> true (#11125), later miss -> false; digest = tag+options+content digests :2226.
- `slang-session.cpp:2612-2641` loadSerializedModuleContents: same order (:2619 then :2633), silent drop on miss (#12789 site).
- Encode `source/slang/slang-serialize-container.cpp:234-350`: idx0 relative to linkageRoot (first search dir containing module)
  :293-326; others `getRelativePath(moduleDir, ...)` :332. Format is self-consistent by position; decoder ignores the base.
- Hash: `slang-linkable.cpp:308-338` getEntryPointHash -> module buildHash -> `slang-module.cpp:50-80` computeDigest appends each
  dep's content digest; deps deduped by SourceFile* (identity = canonical path), so two identical-bytes files = 2 entries.
- Callers of loadSerializedModuleContents: `slang-session.cpp:1425` (reached also via module-library / loadModuleFromBlob — learnings #12663).
- Side observation (out of scope): `slang-serialize-container.cpp:340` string-backed dep stores canonicalModulePath, not its own path.

## Root cause verdict
DECODE side (reload resolution). The recorded paths are correct and unambiguous given the positional contract
(idx0 = linkageRoot-relative, rest = moduleDir-relative); the reload treats non-primary entries as include-search paths and
consults the moduleDir base only as a fallback. Encode only "contributes" in that it records no explicit base marker.

## Candidate approaches
### A (RECOMMENDED): resolve non-primary deps strictly relative to the recovered module source
- Where: one shared helper used by both slang-session.cpp:2198-2208 and :2615-2639.
- Delta: idx>0 and source recovered -> `findFile(SLANG_PATH_TYPE_FILE, moduleSrc, dep)` (no search sweep); miss = stale / not
  added. Source not recovered -> keep today's behaviour (standalone precompiled module).
- Tradeoffs: decode-only, no format change, works for existing .slang-module files; one source of truth so freshness check and
  recorded identity can't diverge. A dep whose original was deleted but has a same-relpath copy on a search root now goes
  stale/dropped instead of silently binding the copy (correct).
- Risk: low-medium; touches every binary-module load with source present. Must keep #11125 standalone path and #11921 absolute paths.
### A' (lower blast radius): only swap the order (source-relative first, then today's fromPath+search lookup)
- Fixes both repros; still binds a shadow copy when the original is missing. Acceptable fallback if A breaks a test.
### B: encode an explicit base/absolute anchor per entry (format change)
- Needs IR/module version bump, absolute paths hurt cache relocatability; old binaries still wrong. Reject for this bug.
### C (reject): dedupe deps / hash by content (UniqueIdentityMode hash) — masks the hash drift, not the stale-reuse bug.
### D: defer into the #9400/#12789 path-subsystem redesign — not warranted: A is a contained root-cause fix with wrong-code impact.

## Recommended path
Approach A via one helper shared by both functions. Repro: build `/workspace/agent/repro-14359` against the fixed lib; run
`./build/slang_cache_path_repro <new dir>` (its collision require()s will now FAIL by design — expect warm dep=prod, 4/4 deps,
cold hash == warm hash) and `./stale <new dir>` (expect collision warm module = .slang and `int(8)`). Acceptance: (1) both
repros fixed, control unchanged; (2) new unit test in tools/slang-unit-test (pattern: unit-test-ir-blob.cpp
`irBlobImportUpToDateCheck`, unit-test-downstream-args-session.cpp) with prod/shadow temp layout asserting dep identity + stale
detection via `ISession::isBinaryModuleUpToDate`; (3) existing irBlob*, serializedModuleFreshness*, DepfileOutput unit tests +
tests/modules/ pass. PR should cross-ref #12789/#9400 and state the invariant "non-primary deps are module-source-relative".

## #12789 overlap
Same two loops. #12789 = miss -> silent drop (observability, on hold for redesign). #14359 = hit on wrong file because of lookup
order (correctness). Independent fix; A does not need the redesign and does not conflict with #12789's diagnostic branch.

## Sources
- DeepWiki x2 (lookup order "intended to match" encode base — loose; findFile order; SourceFile identity by path).
- Shared learnings: #9400 redesign steer; #11918/#11921 encode fallback; stale-binary digest note (search-path strings must match);
  #12663 shared-loader callers; getEntryPointHash cache-key notes (#13197).
- Related open: #9400, #12789, #13343, #11952, #9004. No duplicate.
