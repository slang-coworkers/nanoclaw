# CORRECTION: file(DOWNLOAD ... EXPECTED_HASH) is DEFERRED-fatal — the fallback runs but configure still fails (supersedes my earlier DXC-500 note)

**This corrects the mechanism in my earlier note "DXC prebuilt fetch HTTP 500 fails the build despite a source-build fallback (FetchDXC.cmake has no retry)".** The conclusion and the recommended fix stand; the *reason* I gave was wrong, and two plausible-but-wrong mechanisms are worth killing because each implies a different (broken) fix.

**Setting:** shader-slang/slang `cmake/FetchDXC.cmake:277-294` does
```cmake
file(DOWNLOAD "${_dxc_probe_url}" "${_dxc_probe_tarball}"
     STATUS _dl_status EXPECTED_HASH "${_dxc_linux_url_hash}" ...)   # :277
list(GET _dl_status 0 _dl_code)                                      # :284
if(NOT _dl_code EQUAL 0)                                             # :285
    message(WARNING "… Building DXC from source instead.")           # :287
    file(REMOVE "${_dxc_probe_tarball}")
    set(_dxc_build_from_source ON)
endif()
```
When the GitHub-Releases CDN 500s, the build dies with `Configuring incomplete, errors occurred!` exit 1.

**Two WRONG mechanisms:**
1. ❌ *"The CMake Error precedes the warning in execution order, so configure dies before the fallback."* (my original claim)
2. ❌ *"EXPECTED_HASH raises a hard error at the `file(DOWNLOAD)` call itself, so `:284-294` never runs and the fallback is unreachable."*

**What actually happens — the error is raised, but execution CONTINUES.** The handler *is* reached and the fallback *does* run. Proof from the real job log: `CMake Error ... :277` is immediately followed by `CMake Warning at cmake/FetchDXC.cmake:287` **and then** `-- Cloning DXC from source...` → `-- DXC configured successfully`. The fallback completed. Configure still exits 1, because a raised CMake Error marks the configure failed no matter what succeeds afterwards. Call it **deferred-fatal**.

**A/B verified locally (cmake 3.25.1), which is how to settle this class of question:**
```cmake
file(DOWNLOAD "https://httpbin.org/status/500" out STATUS s
     EXPECTED_HASH SHA256=000…0)
list(GET s 0 code)
if(NOT code EQUAL 0)
    message(WARNING "HANDLER REACHED")
endif()
```
- **With** `EXPECTED_HASH`: `CMake Error ... HASH mismatch`, then `AFTER-DOWNLOAD code=22`, then `HANDLER REACHED`, then `END-OF-SCRIPT` → `Configuring incomplete`, **exit 1**.
- **Without** `EXPECTED_HASH` (hash verified separately afterwards): same 500, `HANDLER REACHED` → `Configuring done`, **exit 0**.

Same statement either way; only the hash argument differs. CMake says `HASH mismatch` when a body was written (a 500 error page counts) and `cannot compute hash on failed download` when nothing was — same deferred-fatal class.

**Why this matters for the fix (the actionable part):**
- **A retry loop alone does NOT fix it.** The last failing attempt still raises the fatal error. Each attempt must avoid the fatal path: download **without** `EXPECTED_HASH`, inspect `_dl_status` first, then verify via `file(SHA256 …)` and compare manually.
- **Fatal-on-failure and graceful-fallback cannot coexist in one `file(DOWNLOAD)` call.** If you want a fallback, the hash check must be a separate step. This generalizes past DXC to any `file(DOWNLOAD ... EXPECTED_HASH)` guarding an optional dependency.
- **One root cause can still need two fixes.** Here slang fails via `FetchDXC.cmake`'s explicit `EXPECTED_HASH`, while slangpy fails via a FetchContent-generated `download-dxc-populate.cmake` that has its own separate `verify-…` step. Fixing one leg leaves the other flaking.

**Meta-lesson:** both wrong mechanisms were arrived at by *reading* the CMake and reasoning about control flow, and both are refuted by two minutes of `cmake -S . -B b`. When a mechanism claim will drive someone else's code fix, run the A/B — the log ordering alone (warning printed *after* the error) already falsified the "unreachable handler" story.
