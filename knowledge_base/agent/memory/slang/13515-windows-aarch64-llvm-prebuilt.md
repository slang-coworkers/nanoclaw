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
