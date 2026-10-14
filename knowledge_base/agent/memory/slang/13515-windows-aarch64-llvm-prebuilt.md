---
type: chain
title: slang#13515 — Windows aarch64 builds time out at 120 min after #13139 changed the LLVM prebuilt key
description: TERMINAL 2026-10-12. #13139 moved the LLVM prebuilt cache key and nothing seeded the new tarballs, so CI cold-built LLVM into the 120-min ceiling and evicted merge-queue PRs. Fixed by #13526 (auto-population workflow), merged 09:07Z; master key now b3ad5163 with all critical prebuilts live. Distilled 2026-10-13 from a ~17KB re-chase log.
tags: [slang, ci, infra, windows-aarch64, llvm, terminal]
---

# slang#13515: no LLVM prebuilt for the post-#13139 cache key

**State: TERMINAL 2026-10-12 09:07Z.** jkiviluoto-nv merged the fix PR **#13526** ("Populate LLVM prebuilts
automatically after recipe changes", `f7e14a1a62`) and #13515 auto-closed (COMPLETED). The bot posted and closed
nothing. All re-chase tasks (`rechase-13515-*`) are consumed or cancelled.

## Root cause

tangent-vector merged #13139 at 2026-10-08 05:30Z (`e83310cf26`), editing `external/build-llvm.sh`. The prebuilt key is
`hashFiles('external/build-llvm.sh', 'external/llvm-*.patch')` (`common-setup/action.yml:128`), so it moved to `6bf2a1a7…`.
Nothing could seed it: the upload step runs only when `github.ref == 'refs/heads/master'`
(`setup-llvm-from-gcs/action.yml:90`), and ci.yml triggers only on `workflow_dispatch`, `merge_group` and `pull_request` —
no `push: master`. `perf-push-benchmark-results.yml` happened to seed x86_64; nothing built Windows aarch64.

Tarball name: `llvm-<os>-<compiler>-<platform>-<key>.tar.gz` (inferred from `setup-llvm-from-gcs/action.yml:93`). Probe by
exact URL — a GCS wildcard URL always answers 404, which caused one false "windows-x86_64 missing" reading.

## Impact (as corrected over the chain)

- **Windows aarch64** cold-built LLVM (~112–114 min) and hit the 120-min limit. Those jobs are **not** in `check-ci`'s
  `needs` (ci.yml:959-1004); master's required checks are `check-formatting`, `check-ci`, `SlangPy Tests`. Noise + runner cost.
- **macOS aarch64** (debug and release) **is** a `check-ci` need: cold builds ran 74–118 min, a race against 120 min and
  the 2h queue timeout. It caused **3 `checks_timed_out` evictions** (#13479 10-08, #13503 10-09, #13450 10-09); 0
  macOS `failed_checks`. My first "not a merge block" was right only for Windows.
- **linux-gcc-x86_64** was also missing, but in merge_group it cold-builds in ~15 min with sccache (sanitizer 45–49 min),
  so it was never a ceiling risk. Other evictions in the window came from `SlangPy Tests` or the zstd seed, not this issue.

## Fix rounds on #13526 (each one a "seeded" that wasn't yet a fix)

1. jkwak-work: "Didn't we already have a workflow that populates LLVM?" → revised (`715915894`) to extend the existing
   sccache-population workflow, adding Windows ARM64/WASM.
2. **zstd seed** (10-09 09:49Z, run 37901293438): linux tarballs built with zstd; consumer containers lack it and fail at
   `LLVMExports.cmake:64 zstd::libzstd_shared`. Deleted 11:32–12:03Z. Requeues after the deletion were *not* wasted —
   #13503 went green and merged 16:29Z (I had wrongly claimed otherwise at 12:30Z).
3. **Validator C++ std**: Windows/macOS reseed failed validation (MSVC C2429, macOS `is_enum_v`); fixed with
   `cxx_std_17` (`056a9e8bf3`).
4. **MSVC toolset skew**: seed on hosted `windows-2022` (MSVC 19.44.35229) vs consumer runner `win-build-3afc5884`
   (19.43.34810) → deterministic `LNK2019 __std_find_first_of_trivial_pos_1` linking `slang-llvm.dll`. Fixed by
   `15848f85a7` "Match Windows LLVM population to the consumer toolset"; the republished `.lib`s dropped the symbol
   (babysitter's finding) and the three `build-windows-*-cl-x86_64-gpu*` jobs went green.
5. Key moved twice more: `dfeb31f6…` (reseed after the zstd removal), then **`b3ad5163…`** when `e15770f1f0` reworded one
   comment line in `build-llvm.sh`. jvepsalainen-nv approved `e15770f1f0` 10-12 07:46Z; merged 09:07Z.

**Final state (recomputed on origin/master):** key `b3ad5163`; 200 for linux-gcc-x86_64, macos-clang-aarch64,
windows-cl-aarch64, windows-cl-x86_64. Only `linux-gcc-wasm` is 404 (15-min build, off the critical path).
`macos-clang-x86_64` is unused (every macOS ci.yml entry is aarch64).

## Leftovers

- 8 human fork PRs went red from 2h cancels on the old key (#13371, #13539 pdeayton-nv; #13520, #13521, #13523, #13524,
  #13513 rkoivunen-sw; #13532 jkwak-work). Fix is a master merge / update-branch by the author (bot can't push forks).
  Authors rebased 5 of them unprompted; #13524's sanitizer downloaded the `b3ad5163` prebuilt and passed in 61 min.
- Sibling **#13540**: on a master cache miss the "Upload LLVM to GCS" step exits 1 when gcloud has no active account; it
  turned the Release workflow red 10-09 and 10-10. Open/unassigned at last check; not owned by this chain.

## Lessons

- Any byte change to `build-llvm.sh` — even a comment — moves the key. Recompute it on every new head (sha256 over the
  per-file sha256 of the hashed files reproduces `hashFiles` exactly); never carry a key forward.
- A seed that "publishes" isn't a fix until a consumer job has **linked** against it (the zstd and MSVC-skew rounds).
- "Not a merge block" must be checked per job against `check-ci`'s `needs`, not per platform.

Related: [[slang/13436-downstream-args-cross-level.md]] (#13450 needed a human requeue after its eviction).
