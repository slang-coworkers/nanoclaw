---
type: chain-record
title: "slang#14471 — windows-aarch64 slangc 0xC0000005 = new runner image's MSVC 14.52 (pinned via #14491)"
description: Closed maintainer-owned CI infra issue; windows-11-vs2026-arm image 20261112.217.1 broke aarch64 builds, fixed by pinning MSVC 14.44
---

# slang#14471 — windows-aarch64 slangc access violation (runner image MSVC 14.52)

- Filed 2026-11-13 18:15Z by **jkwak-work** (maintainer); assigned to the author by jhelferty-nv
  — HELD rung 4: no dispatch, no post. The webhook arrived 11-16, after close.
- **CLOSED 2026-11-14 17:35:36Z by jkwak-work**, right after fix PR **#14491** merged
  (17:35:33Z, `fix-windows-aarch64-build-failure`, commit cdca151f). TERMINAL; no bot work at any point.

## Root cause (jkwak-work's investigation, cmt 2026-11-14)

Not a Slang source change. GitHub serves two `windows-11-vs2026-arm` images at once:

| image | MSVC | aarch64 build jobs |
| --- | --- | --- |
| 20261101.203.1 | 14.51.36231 | 149 passed |
| 20261112.217.1 | 14.52.37025 | 14 failed (8 debug, 6 release) |

- Debug jobs: `slangc.exe` exits `0xC0000005` at `examples/cpu-shader-llvm/shader.o`.
- Release jobs: `cl.exe` C1001 at `source/slang/slang-emit-hlsl-prelude.cpp(468)`.
- Pinning `toolset: 14.44` + an LLVM built with it passes on the new image.
- Fix: PR **#14491** pins MSVC 14.44 on Windows ARM64 (new LLVM prebuilt key); remove the pin
  when GitHub fixes the image. Upstream report: actions/runner-images#15328.
- Probe PRs during investigation: #14472 (re-run on ToT), #14485, #14486 (both DO NOT MERGE).

## #14499 — bot-filed duplicate (2026-11-16) → UPGRADED 11-19: pin-coverage gap

2026-11-16: triaged as duplicate of this record (comment 6913539117), parked on
maintainer close. **2026-11-19 reopen — skiminki-nv's comment (7016223633) supplied a
release-workflow occurrence that the pin does NOT cover:**

- Run 44538577653 = Release workflow, push on branch `v2026.22.1` (head `a4d69f8`,
  contains the pin, ahead-20 of `cdca151f`), job `release (windows, release, aarch64)`.
- Attempt 1 built with **`MSVC\14.52.37025\bin\Hostx64\arm64`** (log receipts:
  `/workspace/agent/scratch/14499/job1.log` lines 4459–4496) → same C1001 ICE at
  `slang-emit-hlsl-prelude.cpp:468`. Attempt 2 passed (crash is nondeterministic).
- Root gap: common-setup's pin condition `inputs.os=='windows' && runner.arch=='ARM64'`
  misses the release job because it **cross-compiles on an x64-hosted runner** — the
  pin must key on the target (windows + `inputs.platform=='aarch64'`), including the
  msvc14.44 LLVM-prebuilt key at line ~137.
- Triager posted the revised disposition 11-19 (comment 7016392050): release job runs
  `windows-latest` with `arch: amd64_arm64`; attempt 2 passed on **image luck** —
  attempt 1 landed on image 20261111.635 (default 14.52.37025), attempt 2 on older
  20261103.629 (14.51.36231). Offered to PR the common-setup fix; **fixer chain held
  for maintainer reply / operator go-ahead**. Process note: `gh run view --job --log-failed`
  silently returns the LATEST attempt's log — use the attempts API + job-logs endpoint.

## Recurrence 2026-11-19 — Release workflow, v2026.22.1 (maintainers own it; no bot action)

- **skiminki-nv recorded a recurrence** (cmt 7016212896, 17:06Z) on the closed issue, per
  jkwak-work's standing "if it happens again, record the run URL" instruction. Issue stays
  closed; rung 4 — no dispatch, no post. Run 44538577653 (`Release`, push on tag
  **v2026.22.1**, created 13:57Z): job **`release (windows, release, aarch64)`** (id
  135610505968) failed at the **Build Slang** step on attempt 1 (completed 14:15Z); attempt 2
  succeeded. Failure signature unverified (job logs need auth; gateway GitHub token stale).
- **Key structural fact:** the Release workflow's windows-aarch64 job **cross-compiles on
  `windows-latest` (x86_64)** — matrix entry `{platform: aarch64, arch: amd64_arm64,
  runs-on: windows-latest}` (release.yml). The 14.44 pin lives in common-setup/action.yml
  gated on `runner.arch == 'ARM64'`, so **the pin does NOT apply to this job**; it uses
  whatever MSVC the x86_64 windows-latest image ships. v2026.22.1 demonstrably contains the
  pin (verified at the tag ref), so a recurrence there is plausibly the same MSVC-crash class
  in a surface the pin never covered — but that is unconfirmed without logs.
- If a maintainer reopens #14471 or asks, this is the surface distinction to check first
  (native-ARM64 CI jobs = pinned; Release cross-compile job on windows-latest = unpinned).

## Why future chains may touch this

- windows-aarch64 CI failures (0xC0000005 at `shader.o`, or C1001 in emit-hlsl-prelude) may recur
  if the pin is removed or another image bump lands — check this record before triaging as a Slang bug.
- Probe PRs #14485/#14486 are intentionally never merged.
- **2026-11-16: slang#14499 filed by the CI babysitter as a "new first-seen" signature — it is a
  DUPLICATE of this chain** (the record above covers both the slangc AV and the release-job C1001 at
  `slang-emit-hlsl-prelude.cpp(468)` on MSVC 14.52). Triager dispositioned it same-day (bot comment
  10:13Z on #14499, maintainer-close recommended). Occurrences on #14483/#14488 predate the #14491
  merge; **#14490's 11-16 failure is a stale branch behind master (no 14.44 pin) → fix is rebase, not
  a new issue.** #14495 passed only via sccache cache hit (TU never compiled). The babysitter's
  tracked-regressions auto-exclusions for this signature are correct — keep them.

## TERMINAL 11-20 (Main, live-verified; postmortem learning saved by the owning chain)

**#14499 closed via merged PR #14642** — jkwak-work's "Build the Windows aarch64 release on a native
ARM64 runner" (`Fixes #14499`, merged 2026-11-20T00:43:04Z): the aarch64 release build moves to a
native ARM64 runner, which supersedes both the cross-compile path and the #14491 MSVC-pin workaround
for this job class — and resolves the 11-19 recurrence concern (v2026.22.1 failing on
windows-latest x86_64 cross-compile where the pin does not apply; skiminki-nv's cmt 7016212896).
Parent **#14471 closed (completed)** as well. Both chain artifacts terminal; the "why future chains
may touch this" notes above remain valid for any OTHER leg still cross-compiling.
