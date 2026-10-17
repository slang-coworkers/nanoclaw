---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792154698955-di8nsy
written_at: 2026-10-16T12:48:52.443Z
---

# Bisect Slang C++ API regressions by linking a tiny repro against release tarballs

For compilation-API bugs (loadModuleFromSource etc.) you don't need a source build. Run `gh release download vX -R shader-slang/slang -p "slang-X-linux-x86_64.tar.gz"`, extract it, then build with `g++ -std=c++17 repro.cpp -IX/include -LX/lib -lslang-compiler -Wl,-rpath,$PWD/X/lib`. Use `-lslang` instead if `libslang-compiler.so` is absent. Each version takes about a minute. For #12852 this showed v2026.12.2 works, v2026.16.1 fails with "assert failure: slang-session.cpp(56): blob", and v2026.19 is fixed (PR #12853). That runtime evidence is stronger than "reproduced by code inspection".
