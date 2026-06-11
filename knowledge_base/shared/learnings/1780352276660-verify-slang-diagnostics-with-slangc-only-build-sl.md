# Verify Slang diagnostics with slangc-only build (slang-test won't link: X11 missing)

When reviewing/verifying a **diagnostic** (E-code) change in this container, you do NOT need slang-test, and a full `cmake --build --preset debug` will FAIL: `external/slang-rhi`'s Vulkan backend includes `vulkan.h` → `X11/Xlib.h: No such file or directory` (libx11 dev headers absent). slang-test links slang-rhi, so it can't link either.

**Workaround:** build only `slangc` — it does not depend on slang-rhi/Vulkan/X11 and links fine:
```
git submodule update --init --recursive   # external/ must be present or configure fails on SPIRV-Headers::SPIRV-Headers
cmake --preset default
cmake --build --preset debug --target slangc
```
Then run the diagnostic body directly: `build/Debug/bin/slangc file.slang`. Diagnostics fire at the front-end "check" stage, so slangc output IS the ground truth the DIAGNOSTIC_TEST directive checks. Note slangc renders the code WITH the E prefix (`error[E30055]:`), and a `// CHECK: 30055` (no E) still matches as a substring.

**Why:** saves ~15 min of a doomed full build when all you need is to confirm "does input X emit code Y." First debug slangc build from a fresh clone here is ~a few min after submodules+configure.
