---
name: project_12327_fetchdxc_retry_shared_helper
description: "#12327 (jvepsalainen-nv, human, self-assigned Q3-2026) — asks to extend #12323's retry to FetchDXC.cmake + factor a shared helper. Its own text is internally inconsistent: Motivation says the slang leg FAILED, Current-behavior says the fallback works. Log settles it — deferred-fatal EXPECTED_HASH ⇒ retry-alone and a naive shared helper both leave the bucket alive. KEY NEW FACT: FetchedSharedLibrary.cmake has NO hash check (that's WHY #12323's retry works); FetchDXC:253-263 already has the split-hash pattern for the cache path."
metadata:
  node_type: memory
  type: project
  originSessionId: main-2026-08-03
---

**shader-slang/slang#12327** — "cmake: retry transient DXC prebuilt download in FetchDXC.cmake (same fragility #12323 fixes for FetchedSharedLibrary)". Filed **2026-08-03 13:41:41Z by `jvepsalainen-nv`** (`user.type: User`, `author_association: MEMBER` — genuine human inbound, NOT a bot echo). Label `CI Stability`, **self-assigned**, milestone **Q3 2026 (Summer)**, **0 comments**. Canonical thread `gh-issue-shader-slang/slang-12327`.

**This issue is the direct downstream of our own comment `5166369597` on #12323** — we asked for exactly this tracking issue and he filed it. See [[project_12116_dxc_prebuilt_zip_500_fetch_flake]] for the origin sweep.

## The correction that matters — his fix shape would leave the bucket alive

The issue is **internally inconsistent**, and his own Motivation section holds the disproof of his Current-behavior section:

- **Motivation** (correct): slang `build-linux-debug-gcc-x86_64` **failed** at `cmake/FetchDXC.cmake:277` with `file DOWNLOAD cannot compute hash on failed download`.
- **Current behavior** (wrong): *"On failure it warns, removes the tarball, and sets `_dxc_build_from_source ON` … That fallback is correct but slow and noisy"* — framing the slang leg as merely a slow source build, and only the cross-repo slangpy leg as a hard fail.

**Both legs hard-failed.** Main-verified from the live job log (run `30808644796` attempt 1, job `91669905966`, PR #12116 head `5c0e69c0c059`, 11:13-11:16Z, 1273 lines, still retrievable):

```
1023  CMake Error at cmake/FetchDXC.cmake:277 (file):
1024    file DOWNLOAD cannot compute hash on failed download
1026      status: [22;"HTTP response code said error"]
1031  CMake Warning at cmake/FetchDXC.cmake:287 (message):
1032    Failed to download DXC prebuilt binary: "HTTP response code said error".
1033    Building DXC from source instead.
1038  -- Cloning DXC v1.9.2602 from source (...)
1039  -- Configuring DXC from source (v1.9.2602)...
1040  -- DXC configured successfully
...
1097  -- Configuring incomplete, errors occurred!
1098  ##[error]Process completed with exit code 1.
```

Error at **1023 precedes** the warning at 1031. The fallback **ran and completed perfectly** (1038-1040), configure continued ~55 more lines of `Performing Test CXXFLAG_*` probes, **and the run still exited 1**. `grep -n "CMake Error"` over the whole log = **exactly one hit, line 1023** ⇒ FetchDXC:277 is the sole cause. Recovered only by rerun (attempt 2 job `91688539350` 12:38-12:54Z green), never by the in-script fallback.

⇒ **`EXPECTED_HASH` is DEFERRED-fatal, now confirmed by production log and not merely by local A/B.** This upgrades the [[project_12116_dxc_prebuilt_zip_500_fetch_flake]] meta-lesson from reproduced-locally to observed-in-the-wild.

## ✅ KEY NEW STRUCTURAL FACT — why #12323's retry works and a lifted copy would not

**`cmake/FetchedSharedLibrary.cmake` has NO hash check at all — before or after #12323.** `grep -i hash` = **zero matches** at both master `53b76e6d3` and PR head `6b75561b`. No `EXPECTED_HASH`, no `file(SHA256)`, no compare.

That absence is **load-bearing**: without `EXPECTED_HASH`, `file(DOWNLOAD)` returns a nonzero `STATUS` on HTTP failure instead of raising, so a retry loop wrapped around it **gets control back**. #12323's loop (head `6b75561b`, +47/−3, single file, `max_attempts 3`, `INACTIVITY_TIMEOUT 60`, backoff 5s/10s, post-loop `message(WARNING)` + `return()` — non-fatal) works *because* of it.

⇒ **Two consequences for his proposal, both under-specified in the issue:**
1. **Retry alone is insufficient** for FetchDXC — the final failed attempt still raises the deferred-fatal error, because `EXPECTED_HASH` is still in the call. The bucket survives.
2. **A naively-factored shared helper inherits the bug.** Lifting `download_and_extract`'s loop and calling it from FetchDXC while keeping `EXPECTED_HASH` reproduces the exact failure at the new call site. The helper must take the expected hash as a *parameter* and verify it **after** the STATUS check, never via `EXPECTED_HASH`.

**The fix shape already exists in his own file:** `FetchDXC.cmake:253-263` hash-checks the *cached* tarball out-of-band — `file(SHA256 "${_dxc_probe_tarball}" _dxc_probe_sha256)` at **:254**, compared against `_dxc_linux_sha256` at **:255**. The download path just doesn't use it. So the recommendation is "apply your own cache-path pattern to the download path", not a new invention.

## Master-HEAD state (verified `53b76e6d3`)

`FetchDXC.cmake` 918 lines. `file(DOWNLOAD)` at **:277-283**, `EXPECTED_HASH "${_dxc_linux_url_hash}"` at **:280** (set at :59), `SHOW_PROGRESS`, no retry. Graceful handler **:285-294** — `message(WARNING)` :287-291, `file(REMOVE)` :292, `set(_dxc_build_from_source ON)` :293.

## Dedup — clean

REST `search/issues` (`gh search` 401s; GraphQL outage per [[project_github_actions_graphql_401_outage]]): `FetchDXC` → 4 open = #12327, #12323, #11448, #11441. `"download retry"` → **only #12323 + #12327**. #11448/#11441 are `SLANG_USE_SYSTEM_DXC` (different feature, not resilience). **No duplicate, no competing in-flight fix.**

## Disposition

**Routed to `slang-triager`** on the canonical thread (human `issue_opened`, not a PR). **FIX HELD — do NOT dispatch fixer:** maintainer **self-assigned** and is actively working the sibling PR #12323 this same hour. `cmake/FetchDXC.cmake` IS bot-pushable (regular source, unlike [[project_bot_workflows_permission]] cases), so the restraint here is ownership/courtesy, not capability. Triage verdict + one comment is the right depth; the maintainer decides the fix.

Per [[feedback_triage_github_posting]] maintainer-assignment does **not** hold a verified verdict, and per [[feedback_dont_post_and_delegate_same_write]] **Main does not post here** — triager owns the write, re-verifying at HEAD first.

**RESUME** on a substantive human reply on #12327/#12323, or if #12323 merges (check whether the helper landed hash-split or hash-in-call — if the latter, the FetchDXC extension is still incomplete and worth one follow-up).

## ✅ CLOSED 2026-08-03 14:00Z — comment `5167307129`, chain terminal coworker-side

https://github.com/shader-slang/slang/issues/12327#issuecomment-5167307129 — `nv-slang-bot[bot]`, 5608 chars, fresh comment (count was still 0). Classified enhancement / CI hardening / medium / **P2** / build-system. Type was already `Testing` ⇒ no GraphQL needed (401 again; REST fine). Labels untouched.

⚠️ **Credit correction (triager, accepted):** the zero-hash-check fact was **in my briefing** as the load-bearing fact — the triager *verified* it at both refs, did not discover it. Not a shared blind spot; my call. Recording because I'd written "neither of us had it," and **misattributing my own finding to a shared gap is a quiet way to inflate a coworker's contribution and lose track of what I actually knew** — the reverse error (claiming their work) is the one I guard against, but this direction corrupts the record too.

**Triager upgraded my inference to proof rather than relaying it** — local repro, cmake 3.25.1, 4 minimal cases, plus the two counterfactuals that actually settle the recommendation:
- **CF1** (#12323's loop with `EXPECTED_HASH` left in) ⇒ `CMake Error` on **every** attempt — 3 errors, not 1 — and configure still exits 1. **Bucket alive, and noisier than before.**
- **CF2** (hash split out, `file(SHA256)` after the STATUS check) ⇒ no error, `-- Configuring done`, exit 0.

All my CI numbers verified exactly (1273 lines, single error@1023, warning@1031 after it, fallback 1038-1040, 54 `Performing Test` lines, exit 1@1098, green only via rerun `91688539350`); `FetchedSharedLibrary.cmake` zero hash matches at both refs confirmed. **This is the right shape for a mechanism claim I'm about to make publicly on a maintainer's own code: dispatch it to be re-derived, not re-typed.**

### Two scope facts I missed — both narrow the shared-helper pitch

1. **The `:277` probe is Linux-x86_64 only** — guard at `:206-211` (native Linux, no custom URL, `x86_64|amd64|AMD64`). It's the GLIBC-detection fetch, so the fix covers the leg that broke, not other platforms.
2. **There is a second fetch a `file(DOWNLOAD)` helper cannot reach** — `FetchContent_Declare` at `:864` with `URL_HASH` at `:862` is the real download on **Windows** (`:805-808`) and on Linux when the probe tarball is absent (`:817-819`); Linux otherwise reuses the probe via `file://` at `:814-815`. **`FetchContent` has no retry knob**, so his *"any future fetched dependency inherits it"* is **bounded to `file(DOWNLOAD)` call sites**. Posted as a scope note, not a blocker — he should know before picking the helper shape.

**Prior art:** merged **#10602** (`curl -f --retry 3 --retry-delay 5`, shell layer) — precedent for the direction.

**RESUME (updated):** he asks for review or a PR ⇒ release the fixer. #12323 merging with a FetchDXC follow-up needs **no action from us**. Do not re-engage on bot echoes.
