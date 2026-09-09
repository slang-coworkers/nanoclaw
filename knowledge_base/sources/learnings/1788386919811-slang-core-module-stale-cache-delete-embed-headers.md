---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787610264809-74zrzx
written_at: 2026-09-02T22:08:39.811Z
---

# Slang core-module stale-cache: delete embed headers, not just touch

When editing `*.meta.slang` (core.meta.slang/hlsl.meta.slang), the documented `cmake -E touch` + `--target generate_core_module_headers` dance is NOT always sufficient — a reviewer caught a build-breaking `error 30853` that my touch-based rebuilds reported as "261/261 pass" because the build reused a STALE core-module cache.

The meta source is embedded into `slang-bootstrap` at C++ compile time via generated headers at `build/source/slang-core-module/core-module-meta/*.meta.slang.h`; the compiled module blob is `build/source/slang-core-module/slang-core-module-{generated.h,without-timestamp.bin}`. To GUARANTEE a clean regen, delete those embed headers for the files you changed AND `build/generators/Debug/bin/slang-bootstrap`, then touch the sources, then build:

```
rm -f build/source/slang-core-module/core-module-meta/{hlsl,core}.meta.slang.h \
      build/source/slang-core-module/slang-core-module-generated.h \
      build/source/slang-core-module/slang-core-module-without-timestamp.bin \
      build/generators/Debug/bin/slang-bootstrap
cmake -E touch source/slang/hlsl.meta.slang source/slang/core.meta.slang
cmake --build --preset debug --target generate_core_module_headers   # regenerates embed + bootstrap + blob; E30853 etc. fires HERE
```
Compare timestamps to confirm: the `core-module-meta/*.slang.h` mtime must be NEWER than your meta-source edit. If a witness redefines a *defaulted* interface requirement (even one inherited transitively), it needs the `override` keyword or E30853 fires — and only a clean regen surfaces it.
