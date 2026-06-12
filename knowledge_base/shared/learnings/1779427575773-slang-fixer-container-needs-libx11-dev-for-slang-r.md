# slang-fixer container needs libx11-dev for slang-rhi vulkan WSI build

**Status (2026-05-29):** `libx11-dev` is now in slang-fixer's persistent config (`packages_apt: ["libx11-dev"]`). See `1780060974231-ncl-group-container-fixes-bookworm-package-gaps-ap.md` for the verified-good config. The notes below remain useful for diagnosing similar agent images and as a fallback when libx11-dev is missing.

## Symptom

`cmake --build --preset debug` fails at `external/slang-rhi/CMakeFiles/slang-rhi.dir/Debug/src/vulkan/vk-acceleration-structure.cpp.o` and `vk-api.cpp.o` with:

```
fatal error: X11/Xlib.h: No such file or directory
   58 | #include <X11/Xlib.h>
```

The Vulkan headers (`build/_deps/vulkan_headers-src/include/vulkan/vulkan.h:58`) transitively include `<X11/Xlib.h>` for Xlib WSI support, and `slang-rhi`'s Vulkan backend includes `vulkan.h` directly.

## Workaround #1: build slang/slangc only (skip slang-rhi)

```bash
cmake --build --preset debug --target slang slangc
```

This produces a working `build/Debug/bin/slangc` for filecheck-only tests. **But**: `slang-test` depends on `slang-rhi` so this skips the test runner. You'd run filecheck tests by invoking slangc directly and grepping its output.

## Workaround #2: reconfigure with non-essential parts off

The default cmake preset enables `SLANG_ENABLE_TESTS`, which forces `SLANG_ENABLE_SLANG_RHI=ON`. To build `slangc` without slang-rhi at all (sufficient for diagnostic-test sanity checks — slangc emits the diagnostic, you grep / eyeball the output):

```bash
cd /workspace/agent/wt-<target_slug>
cmake -B build \
  -DSLANG_ENABLE_TESTS=OFF \
  -DSLANG_ENABLE_SLANG_RHI=OFF \
  -DSLANG_ENABLE_GFX=OFF \
  -DSLANG_ENABLE_EXAMPLES=OFF
cmake --build --preset debug --target slangc
```

`slang-test` does NOT build under this config (the runner depends on slang-rhi). For diagnostic tests this is fine — run `./build/Debug/bin/slangc -target spirv-asm tests/diagnostics/<your-test>.slang` and verify the expected `error[E<code>]` appears at the right column. Note this in the PR body so the maintainer/reviewer knows the slang-test runner verification was deferred to CI.

## Caveat I hit (2026-05-21 fixing slang#10747)

Even after the workaround above succeeded, the resulting `slangc` binary exited 1 silently on every invocation including `-help`/`-version` in this container. Never root-caused — could be missing runtime deps from the partial-build path, or the bash tool eating output. If you hit this, fall back to leaning on the existing PR's upstream CI for verification rather than chasing the local binary.

**Don't chase**: I tried `LD_DEBUG=files`, `SLANG_ASSERT=system`, `SLANG_ASSERT=release-assert-only`, redirecting stdout/stderr to files separately — none surfaced the silent-exit-1 cause. Time-box this debugging at 10 minutes; if the issue is environment-side, pivot to upstream-CI evidence for endorsement workflows.

## Other things that may be missing from a similar agent image

- Formatters: `clang-format` (any version), `gersemi`, `prettier`, `shfmt`. `./extras/formatting.sh` short-circuits with "needs X, but it isn't in $PATH". CI runs them; manual self-formatting against neighbor style is the fallback. Bookworm standard repos ship NO `clang-format` package; see related learning on Bookworm package gaps.
- Bundle apt installs together: `clang-format-17 libx11-dev gersemi prettier shfmt` to match Dockerfile expectations. An earlier `install_packages` request that bundled `clang-format-18` failed because Bookworm only has `-17`.

## Durable fix

Request `install_packages` with apt `libx11-dev` + `libxcb1-dev` (admin approval, image rebuild). Add `libxrandr-dev` if WSI-XRandR is needed.
