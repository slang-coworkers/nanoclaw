---
type: chain
title: slang#13515 — Windows aarch64 builds time out at 120 min after #13139 changed the LLVM prebuilt key
description: Filed by slang-ci-babysitter 2026-10-08. The LLVM prebuilt cache key changed and no master-ref run can seed the new tarball. These jobs are NOT in check-ci's needs, so this is noise and runner cost, not a merge block. A maintainer has to seed the prebuilt.
tags: [slang, ci, infra, windows-aarch64, llvm, parked]
---

# slang#13515: no Windows aarch64 LLVM prebuilt for the post-#13139 cache key

tangent-vector merged #13139 at 2026-10-08 05:30Z (`e83310cf26`). It edited `external/build-llvm.sh`, and the LLVM prebuilt
key is `hashFiles('external/build-llvm.sh', 'external/llvm-*.patch')` (`common-setup/action.yml:128`), so the key moved to `6bf2a1a7…`.
The babysitter found that the aarch64 tarball for the new key returns 404, while x86_64 returns 200.

**Why nothing seeds it (verified on master):** the upload step runs only when
`github.ref == 'refs/heads/master'` (`setup-llvm-from-gcs/action.yml:90`). The CI workflow triggers only on
`workflow_dispatch`, `merge_group` and `pull_request`, with no `push: master`. So the only master-ref run that could
upload is a manual `workflow_dispatch` on master.

**Impact:** every run that includes `e83310cf` cold-builds LLVM, which takes about 114 minutes, and times out at the 120-minute limit on
`build-windows-{debug,release}-cl-aarch64 / build`. **The Windows jobs don't block merges** (but see the macOS correction below). Those jobs aren't in `check-ci`'s `needs`,
and master's required checks are only `check-formatting`, `check-ci` and `SlangPy Tests`. Run #13510 shows both aarch64 builds
cancelled while `check-ci` passed. The cost is two 2-hour runners per CI run plus red noise.

**Owner:** maintainers. Fix it by seeding the prebuilt with a `workflow_dispatch` on master, possibly with a raised timeout, and by
deciding who seeds it after future `build-llvm.sh` edits. The bot doesn't push workflows.

- 2026-10-08: the babysitter filed #13515 with verified evidence and no proposed fix. The issue body said the jobs were "probably not required"
  and that the bot had no access to the required checks. I corrected both and asked for a comment giving the required contexts and
  explaining the master-ref trigger gap.
- 2026-10-08 10:40Z: correction comment posted, [6058075329](https://github.com/shader-slang/slang/issues/13515#issuecomment-6058075329), with no pings.
  It gives the required contexts, the `check-ci` needs list (ci.yml:959-1004), and the missing `push: master` trigger. The babysitter also found
  that `perf-push-benchmark-results.yml` seeded the x86_64 tarball; no push workflow builds Windows aarch64.
- 2026-10-08 10:43Z: re-chase task `rechase-13515-aarch64-ll-6a8c` (10-09 09:00Z) probes the new-key aarch64 tarball, checks for maintainer
  comments (routed to the babysitter) and aarch64 job durations, then reschedules +48h up to 3 times. Confirmed in a live check:
  #13485 run 37748993500 cancelled 10:19Z, LLVM `Setup` took 112 min.
- **CORRECTION 2026-10-08 12:25Z (babysitter):** `build-macos-debug-clang-aarch64` also misses the `6bf2a1a7` tarball (404) and cold-builds LLVM.
  That job **is** in `check-ci` needs. It finished in 98 and 103 min on two merge-group runs but hit the 120-min limit on #13481, which turned `check-ci` red.
  So #13515 **can** block merges, intermittently, through macOS debug. My earlier "not a merge block" was right only for Windows. The evidence is posted on #13515.
- **2026-10-08:** jkiviluoto-nv opened the fix PR **slang#13526** ("Populate LLVM prebuilts automatically after recipe changes"). Its own CI is red
  with the same ceiling (it can't seed its own key until it merges). The babysitter's comment 6066643074 adds that the linux `sanitizer` job (also in `check-ci` needs) hits the ceiling too,
  and that #13479 was evicted by `checks_timed_out` at 2h00m09s. So until #13526 merges or someone dispatches the upload, this regularly evicts PRs.
- **2026-10-08 ~22:30Z, scope widened.** I probed `llvm-<os>-<compiler>-<platform>-6bf2a1a7….tar.gz`. My key naming is inferred from `setup-llvm-from-gcs/action.yml:93`.
  - Missing (404): `windows-cl-aarch64`, `macos-clang-aarch64`, `linux-gcc-x86_64`, `macos-clang-x86_64`.
  - Present (200): `windows-cl-x86_64`, `linux-gcc-aarch64`.
  - Resolved: the babysitter's earlier windows-x86_64 404 came from a wildcard URL, which GCS always answers with 404. Probed by exact URL, it returns 200 (re-probed 10-09 00:15Z).
  - Because `linux-gcc-x86_64` is missing, linux-release and `sanitizer` also cold-build and hit the ceiling. Both are `check-ci` needs, so `check-ci` goes red on PRs that changed nothing related (#13395, #13525).
  - This is now the main merge blocker. #13477 was re-enqueued by a human at 22:11Z.
- **2026-10-09 09:00Z, re-chase check 1 of 3 (still unseeded).**
  - Key still `6bf2a1a7…`: neither recipe file has changed since `e83310cf26`.
  - Still 404: `windows-cl-aarch64`, `macos-clang-aarch64`, `linux-gcc-x86_64`, `macos-clang-x86_64`. Still 200: `windows-cl-x86_64`, `linux-gcc-aarch64`.
  - #13515 is open, assigned to jkiviluoto-nv, with no non-bot comments.
  - #13526: jkwak-work asked "Didn't we already have a workflow that populates LLVM?". jkiviluoto-nv agreed and revised it in `715915894`, which extends the existing sccache population workflow and adds Windows ARM64/WASM. It is not merged.
  - Queue: in 13 merge runs, macOS debug took 74–115 min and never hit 120 min. **0** check-ci failures came from the macOS job.
  - The queue removed PRs without merging 7 times:
    - 5× `failed_checks`, all from the required `SlangPy Tests` status (unrelated).
    - #13479 `checks_timed_out`, **caused by this issue**: `build-macos-release-clang-aarch64` took 118 min and pushed check-ci past the 2h queue timeout.
    - #13481 `checks_timed_out` (GPU runner wait, unrelated).
  - **Correction:** in merge_group runs, linux-gcc-x86_64 cold-builds LLVM in about 15 min with sccache (linux-release 20–25 min, sanitizer 45–48 min), so it is not a ceiling risk.
  - Sibling #13540: on a master cache miss, the upload step exits 1 when gcloud has no active account.
  - Report sent to the dashboard, msg 11. Next check is `rechase-13515-check2-4715` at 10-11 09:00Z, check 2 of 3. The original one-shot was consumed.
- **2026-10-09 ~12:30Z, the zstd seed and the key move (checked live, not taken from the babysitter).**
  - The 09:49Z seed of `linux-gcc-x86_64` and `linux-gcc-wasm` (run 37901293438, actor jkiviluoto-nv) was built with zstd. Consumers configure inside a container that has no zstd, so they fail at `LLVMExports.cmake:64 zstd::libzstd_shared`. Both objects went 404 again between 11:32Z and 12:03Z.
  - Live at `6bf2a1a7` (12:18Z): 200 for `windows-cl-aarch64`, `windows-cl-x86_64` and `linux-gcc-aarch64`; 404 for `linux-gcc-x86_64`, `linux-gcc-wasm`, `macos-clang-aarch64` and `macos-clang-x86_64`. `macos-clang-x86_64` doesn't matter, because every macOS entry in ci.yml is aarch64.
  - **The reseed publishes under a different key.** Run 37924945546 (@ `cb2d0f6a`, "without optional zstd") hashes to `dfeb31f6be1df4ed772128bb4c64fa3b458ea61ef39fb9d70ebde90ec83e1f61`. I computed it the way hashFiles does: sha256 over the per-file sha256 of `build-llvm.sh` and `llvm-coff-pageoffset12l.patch`. The same method reproduces master's `6bf2a1a7` exactly. So master's key stays 404 until **#13526 merges** and master moves to `dfeb31f6`. Any "requeue once `6bf2a1a7` is 200" condition will never be met. At 12:25Z every `dfeb31f6` object was 404, and the reseed was still running.
  - **Merge queue:** #13503 was evicted at 11:23:24Z (`checks_timed_out`, its 3rd removal, skiminki-nv enqueues). #13502 is at position 1, but its group run 37923422416 had already failed linux debug, release and sanitizer at 11:27Z on the zstd signature (job 113796689268, log lines 1066 and 1127). Those are `check-ci` needs, so that run can't pass. Requeueing either PR before #13526 lands is wasted.
- **CORRECTION 2026-10-09 ~16:40Z. My 12:30Z claim that requeues were wasted until #13526 merges was wrong.** The zstd failure only hit runs that downloaded the zstd `linux-gcc-x86_64` tarball, which was live from 09:49Z until it was deleted between 11:32Z and 12:03Z. After the deletion, linux cold-builds cleanly in merge_group, so `check-ci` there is a macOS race (99–118 min against 120), not a certain failure. Proof: #13503 was re-enqueued 14:40Z and its group run 37945990216 went fully green (linux release 22 min, sanitizer 49 min, macOS debug 99 min). It merged at 16:29Z. #13502 also merged, at 14:38Z.
  - **Reseed 2** (run 37924945546 @ `cb2d0f6a`) published only linux `dfeb31f6` objects (linux-x86_64, aarch64 and wasm are 200). Windows and macOS failed in "Validate installed LLVM and Clang packages" because the smoke project set no C++ standard. I checked the logs: MSVC C2429 "requires /std:c++17", and on macOS `no template named 'is_enum_v'`. jkiviluoto-nv had already fixed the validator on #13526 by 16:32Z (`056a9e8bf3`, `cxx_std_17`). **Reseed 3** is run 37959907383 @ `63ddb9cb83`, on the same key `dfeb31f6` (computed), in progress since 16:32Z.
  - Resolution is still: #13526 merged AND `dfeb31f6` is 200 for linux-gcc-x86_64, macos-clang-aarch64 and windows-cl-aarch64.
- **2026-10-09 ~20:30Z: all `dfeb31f6` tarballs are live, but Windows x86_64 fails to link against them (checked live).**
  - The `dfeb31f6` objects return 200 for linux-gcc-x86_64, macos-clang-aarch64, windows-cl-aarch64 and windows-cl-x86_64. Reseed 3 is run 37959907383.
  - #13526 at `04430e751f`, run 37976785880: the three `build-windows-*-cl-x86_64-gpu*` jobs download the prebuilt, then fail to link `slang-llvm.dll` with `LNK2019 __std_find_first_of_trivial_pos_1` (from `LLVMX86Desc.lib`) and `LNK1120`. This is deterministic. Windows aarch64 passes.
  - Toolset skew, checked in the logs: the seed job ran on hosted `windows-2022` with MSVC **19.44.35229** (tools 14.44.35207). The consumer job ran on runner `win-build-3afc5884` with MSVC **19.43.34810** (tools 14.43.34808). The missing symbol is an STL-internal helper that the older runtime doesn't export. That it causes the failure is the babysitter's hypothesis; the version mismatch is a fact.
  - Consequence: merging #13526 as it stands would turn a working Windows x86_64 (the `6bf2a1a7` tarball links fine) into a certain failure on every master build. So the resolution now also requires the Windows x86_64 jobs to be green on #13526's head.
  - The babysitter posted this on #13515 (comment 6088622728, cc jkiviluoto-nv).
- **2026-10-10 01:50Z, #13540 re-chase (read-only).** The Release run 38007081169 (10-10 00:00Z) linux x86_64 leg failed again at "Upload LLVM to GCS" with gcloud reporting no active account, after an ~80 min cold build. So Release has been red 2 nights. The nightlies (Sanitizer, Slang Test) have been blind 1 night each (10-09); the 10-10 nightlies hadn't fired yet when I checked.
  - Prebuilts: `linux-gcc-x86_64` is 404 at `6bf2a1a7` and 200 at `dfeb31f6`. `macos-clang-aarch64` is still 404 at `6bf2a1a7`.
  - #13540 is open and unassigned, with no human comments. #13526 is open and BEHIND at `04430e75`, with Windows x86_64 LNK2019 still red.
  - Reported to the dashboard, msg 7. Next re-chase is `rechase-13540-release-gc-acf7` at 10-11 01:45Z.
