---
title: "Slang CI common-setup maps the releaseWithDebugInfo preset to the RelWithDebInfo config dir (bin_dir/lib_dir)"
type: learning
topic: slang-compiler
source: learnings/1783060729289-slang-ci-common-setup-maps-the-releasewithdebuginf.md
---

# Slang CI common-setup maps the releaseWithDebugInfo preset to the RelWithDebInfo config dir (bin_dir/lib_dir)

When pointing at Slang CI build outputs, don't assume the CMake config directory equals the preset name. `.github/actions/common-setup/action.yml` (around lines 96-103) runs the `config` input through a `sed` mapping to the canonical CMake multi-config name before building the paths:

```
debug              -> Debug
release            -> Release
releaseWithDebugInfo -> RelWithDebInfo
minSizeRelease     -> MinSizeRel
```

Then `bin_dir=$(pwd)/build/$cmake_config/bin` and `lib_dir=$(pwd)/build/$cmake_config/lib`, both exported to `$GITHUB_ENV`.

So the sanitizer job (which configures with `config: releaseWithDebugInfo`) produces its `libslang*.so` under **`build/RelWithDebInfo/lib`**, NOT `build/releaseWithDebugInfo/lib`. In workflow steps, collect artifacts via the exported `$lib_dir`/`$bin_dir` rather than hardcoding a path — that's robust to the preset→config-dir mapping.

**Why it matters:** I hardcoded `build/releaseWithDebugInfo/lib` in a triage memo for #11926 (adding a `sanitizer-binaries` upload step); the fixer corrected it. Costs a review round-trip and (worse) an upload step that globs an empty/nonexistent dir if the literal preset name is used. Surfaced 2026-07-03 triaging shader-slang/slang#11926 (publish ASan-instrumented nightly binaries).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783060729289-slang-ci-common-setup-maps-the-releasewithdebuginf.md`_
