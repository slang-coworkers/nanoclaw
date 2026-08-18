---
title: "CMake file(DOWNLOAD): EXPECTED_HASH is deferred-fatal in configure mode and defeats STATUS-based retry/fallback"
type: learning
topic: ci-tooling
source: learnings/1785765561771-cmake-file-download-expected-hash-is-deferred-fata.md
---

# CMake file(DOWNLOAD): EXPECTED_HASH is deferred-fatal in configure mode and defeats STATUS-based retry/fallback

## The trap

`file(DOWNLOAD url out STATUS st)` returns a nonzero status to the caller on failure — recoverable, so a retry loop or a fallback branch works.

Add `EXPECTED_HASH` to the *same* call and a download failure becomes a recorded hard `CMake Error` that **no `STATUS` check can suppress**. In **configure mode** it is *deferred*-fatal: CMake records the error, lets the script keep running (your `if(NOT status EQUAL 0)` warning fires, your fallback variable gets set, hundreds more lines execute), and then ends with `-- Configuring incomplete, errors occurred!` and **exit 1** anyway.

Empirically verified with cmake 3.25.1, unreachable URL:

| args | result |
| --- | --- |
| `STATUS` only | no error, status returned, `-- Configuring done`, exit **0** |
| `STATUS` + `EXPECTED_HASH` | `CMake Error`, script continues to end, exit **1** |

**Mode nuance that will mislead you:** in `cmake -P` **script** mode the same call is *immediately* fatal — the next statement never runs. The continue-then-fail behavior is **configure-mode specific**. A script-mode repro shows the wrong shape; reproduce with `cmake -S . -B build`.

## Why it matters

A download-failure fallback (`set(_build_from_source ON)`) guarded by `STATUS` is **unreachable-in-effect** when `EXPECTED_HASH` is in the call. The fallback runs and succeeds, and the build still fails. Signature in a CI log: exactly one `CMake Error` early, the fallback's warning *after* it, fallback success messages, then lots of unrelated progress, then `Configuring incomplete` + exit 1.

Adding a retry loop does **not** fix it: the final failed attempt raises the same error (and you get one error *per attempt*, N errors not 1).

## The fix

Split the hash out of the download call and verify it **after** the STATUS check:

```cmake
file(DOWNLOAD ${url} ${archive} STATUS status INACTIVITY_TIMEOUT 60)   # no EXPECTED_HASH
list(GET status 0 status_code)
if(status_code EQUAL 0)
    file(SHA256 "${archive}" actual)          # out-of-band verification
    if(NOT actual STREQUAL expected)
        set(status_code 1)                    # treat as retryable failure
    endif()
endif()
```

Verified: same retry loop with the hash split out ⇒ no `CMake Error`, `-- Configuring done`, exit 0, fallback genuinely usable. Integrity checking is preserved, just moved after the transfer.

**Corollary for shared helpers:** a retry/download helper must take the expected hash as a **parameter** and verify it itself. If it forwards `EXPECTED_HASH` into `file(DOWNLOAD)`, every call site inherits the defect.

Also note `FetchContent_Declare(... URL_HASH ...)` is a *different* mechanism with no retry knob — a `file(DOWNLOAD)` helper does not cover those sites.

## Where seen

shader-slang/slang#12327 (triage) — `cmake/FetchDXC.cmake:277-283` passes both `STATUS` and `EXPECTED_HASH`; a transient HTTP 500 on the DXC CDN failed the build despite a working source-build fallback (run 30808644796 attempt 1, job 91669905966: single `CMake Error` at log line 1023, fallback success at 1038-1040, exit 1 at 1098). Sibling PR #12323's retry works on `cmake/FetchedSharedLibrary.cmake` only because that file has **no hash check at all** (`grep -i hash` = zero matches). Ironically the correct pattern already existed 20 lines up at `FetchDXC.cmake:253-263`, used for the *cached* tarball.

**Method lesson:** the counterfactual A/B (retry+hash vs retry+hash-split-out) is what settled it. "Add a retry" sounded obviously sufficient and was not; four ~15-line local cmake cases refuted it in under a minute. Cheap to run — do it before publishing a load-bearing mechanism claim.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785765561771-cmake-file-download-expected-hash-is-deferred-fata.md`_
