# Proven: slangpy hlsl_nvapi guard fixes slang#11225 E36121 (A/B result)

# A/B PROVEN: slangpy's `hlsl_nvapi` guard fixes shader-slang/slang#11225 E36121

Result of an A/B test of slangpy commit `998aeb2` ("Only request hlsl_nvapi capability where the
NVAPI Slang module is linked", `src/sgl/device/shader.cpp`) against a locally-built Slang at
PR #11225 head (`db61cec`, `git describe` = `v2026.14.1-24-gdb61cec`, NOT merged to master).

| variant | doctest tallies | `hlsl_nvapi` | `E36121` |
|---|---|---|---|
| WITHOUT guard | 200 cases, 167 passed, **33 failed** | 28 | 28 |
| WITH guard (998aeb2) | 200 cases, 195 passed, **5 failed** | **0** | **0** |
| baseline (pinned Slang 2026.12) | 200 cases, 195 passed, 5 failed | 0 | 0 |

The 5 WITH-guard failures are byte-identical to the pre-existing 2026.12 baseline
(3× `test_dds_file.cpp` "DDS file has invalid header", 2× `test_texture_loader.cpp`
"Unsupported source image type") — unrelated to capabilities. So the guard removes exactly the
28 capability errors and introduces nothing.

Verbatim reproduction (WITHOUT arm), matching the issue report exactly:

```
tests/sgl/device/test_cursors.cpp:554: ERROR: test case THREW exception:
  Failed to load slang module "test" from source
error[E36121]: requested capability 'hlsl_nvapi' is incompatible with compilation target 'spirv'
error[E39999]: import failed due to compilation error
fatal error[E40003]: compilation ceased
```

## THE TRAP that produces a false negative

`slang-11225/build/` contains BOTH the real build outputs (`build/Release/lib/`) **and** a
*downloaded release artifact* `build/slang-2026.14.1-linux-x86_64{.zip,/}` that slang's configure
fetches for slang-llvm. That artifact is a **released** build and does NOT contain #11225. Pointing
`-DSGL_LOCAL_SLANG_BUILD_DIR` at it makes BOTH arms come back clean — a false negative that looks
like a genuine result.

**Always prove the binary contains the diagnostic before trusting either arm:**

```bash
strings <dir>/libslang*.so | grep -c 'is incompatible with compilation target'
# real build tree build/Release/lib  -> 2   ✅
# downloaded slang-2026.14.1-*/lib   -> 0   ❌ (would silently invalidate the A/B)
```

Also check what the test binary actually *resolves* at runtime — slangpy copies the lib into its
own build dir, so verify there too:
`ldd build/linux-gcc/Debug/sgl_tests | grep slang` then `strings` that path (got 2 ✅).
Cross-check `build/Release/include/slang-tag-version.h` → `SLANG_TAG_VERSION "2026.14.1-24-gdb61cec"`.

## Reproducing the arms

Configure once (`SGL_HAS_NVAPI` reports OFF on Linux, as expected):
```bash
cmake --preset linux-gcc --fresh -DSGL_LOCAL_SLANG=ON \
  -DSGL_LOCAL_SLANG_DIR=/path/slang-11225 -DSGL_LOCAL_SLANG_BUILD_DIR=build/Release
```
Then per arm: revert/restore only `src/sgl/device/shader.cpp`, `cmake --build --preset
linux-gcc-debug` (incremental ≈ minutes), `python3 tools/ci.py unit-test-cpp`.

Note `git checkout <commit> -- <path>` stages as well as writes the worktree, so a plain `git diff`
looks empty — use `git diff HEAD`. Restore with `git checkout <commit> -- <path>` (or
`git reset --hard <commit>` to also clear the index).

Doctest name filters: `-tc=formats` / `-sc=vulkan` matched nothing here (203 skipped) — run the
whole binary and grep the log instead. `run_gpu_test` is **vulkan-only on Linux**, and a real
NVIDIA L40S was present, so the SPIRV path is genuinely exercised (not GPU-skipped).
