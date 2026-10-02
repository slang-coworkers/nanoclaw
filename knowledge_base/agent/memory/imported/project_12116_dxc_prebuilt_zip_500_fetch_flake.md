---
name: project_12116_dxc_prebuilt_zip_500_fetch_flake
description: "CI-flake signature (2026-08-03): DXC prebuilt zip HTTP 500 from GitHub-Releases CDN fails configure. FetchDXC.cmake GLIBC probe is a no-retry file(DOWNLOAD … EXPECTED_HASH) that is DEFERRED-fatal in configure mode, so the source-build fallback runs but is decorative. Two mechanisms, three sites. #12323 (FetchedSharedLibrary retry) does not cover it; ask posted as cmt 5166369597. Still unfixed on master 2026-10-01."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-03
---

## Signature

`dxc_2026_02_20.zip` from the DirectXShaderCompiler GitHub-Releases CDN returned **HTTP 500** and failed two legs of slang#12116 from one cause:

- slang `build-linux-debug-gcc-x86_64` — `cmake/FetchDXC.cmake` GLIBC probe → `cannot compute hash on failed download` → `Configuring incomplete`, exit 1. (CMake says `HASH mismatch` instead when an error-page body was written; same class.)
- cross-repo `SlangPy Tests` — FetchContent's generated `download-dxc-populate.cmake:163` → `The requested URL returned error: 500`.

**Classify as intermittent:** 1 of 9 configs; the same job green on other runs that hour; the rerun went green (`SlangPy Tests :: success` included). The log line "Building DXC from source instead" is a red herring — see below.

## Mechanism — `EXPECTED_HASH` is deferred-fatal in configure mode

Settled by a one-variable A/B (cmake 3.25.1, a URL returning 500), not by reading source:

| arm | result |
|---|---|
| `file(DOWNLOAD … STATUS _s EXPECTED_HASH SHA256=…)` | `CMake Error`, handler still runs, script reaches its end → `Configuring incomplete`, exit 1 |
| same, no `EXPECTED_HASH`, hash checked separately | handler runs → `Configuring done`, exit 0 |

The raised error dooms the configure even though the graceful handler (`WARNING`, `file(REMOVE)`, `set(_dxc_build_from_source ON)`) runs and the source-build fallback completes (`-- DXC configured successfully` in the real log). **In script mode (`cmake -P`) the same call is immediately fatal** and never reaches the next statement — so a repro must match the failure's execution mode, and a published mechanism must name the mode it holds in.

Two earlier explanations were both wrong ("the error precedes the warning and configure dies there"; "it fatals at the call, so the fallback is unreachable"). Both came from reading CMake; the job log falsified them the whole time.

## Sites and fix shape

Two mechanisms, three call sites:

1. **slang GLIBC probe** — bare single-attempt `file(DOWNLOAD … EXPECTED_HASH "${_dxc_linux_url_hash}")` (master 2026-10-01: `EXPECTED_HASH` at `FetchDXC.cmake:280`, still no retry).
2. **slang prebuilt stage** — `FetchContent_Declare(dxc URL …)` with optional `URL_HASH`, triggered by `FetchContent_MakeAvailable(dxc)` (`:868`). A traceback at `:868` is a FetchContent failure; the raising code is generated, not a second bare download.
3. **slangpy** — the same FetchContent path (`download-dxc-populate.cmake:163`).

**Fatal-on-failure and graceful-fallback cannot coexist in one `file(DOWNLOAD)` call.** A retry loop alone is insufficient, because the final failing attempt still raises the deferred error. The fix is `file(DOWNLOAD … STATUS _s)` without `EXPECTED_HASH` → check `_s` → `file(SHA256 …)` and compare. The FetchContent sites need their own retry.

## Upstream state

- **PR #12323** (jvepsalainen-nv, "Retry fetching a prebuilt shared library…") touches only `cmake/FetchedSharedLibrary.cmake` — a different fetch path — so it does **not** cover this class. Still OPEN 2026-10-01.
- slang-ci-babysitter posted the ask as a **new** comment, `5166369597` (2026-08-03), with the deferred-fatal rationale, the A/B table and both code paths, "no urgency from our side". It names the GLIBC probe and the slangpy FetchContent path but not slang's own `:868` FetchContent site; that omission does not change the count of fixes, so no edit was made (the babysitter owns that footprint — [[feedback_dont_post_and_delegate_same_write]], [[feedback_tell_the_footprint_owner_when_you_post_yourself]]).
- **Resume trigger:** a reply on #12323, or a DXC-500 recurrence (then recheck whether FetchDXC grew a retry).

## Lessons kept

- For "what does this tool actually do in this failure mode", a 10-line reproduction beats source reading — and it must match the real run's mode/flags/version.
- Before an outward write ("I'll go extend that upstream comment"), diff what is published against what you think needs saying; here the artifact already said the right thing.
- A deferred rerun is a hypothesis, not a queued command: re-read state first (a run that already restarted itself must not burn a cap slot).
- The cross-repo rerun of `shader-slang/slangpy` from the bot works end-to-end (attempt counter incremented, run completed green), so intermittent cross-repo reds are bot-actionable.
- A REST wrapper that scanned only the first 200 bytes for error markers passed a rate-limit 403 body through as data; scan or parse the whole payload. The rate-limit exhaustion itself came from the GraphQL-401 REST fallback — see [[project_github_actions_graphql_401_outage]].

Related: [[project_12137_aarch64_apt_fetch_ci_flake]] (dep-fetch-flake family), [[project_11225_capability_target_incompat_slangpy_break]].
