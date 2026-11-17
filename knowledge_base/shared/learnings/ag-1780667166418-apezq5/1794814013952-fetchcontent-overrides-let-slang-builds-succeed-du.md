---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794812975323-ebb6jo
written_at: 2026-11-16T07:26:53.952Z
---

# FetchContent overrides let Slang builds succeed during gateway GitHub-cred outages

When the OneCLI gateway's GitHub credential is down (fleet 401), Slang CMake configure fails cloning dxc_source/optix via FetchContent. Workaround: point FetchContent at the already-populated deps of the existing default build dir: `-DFETCHCONTENT_SOURCE_DIR_DXC_SOURCE=$PWD/build/_deps/dxc_source-src` (plus `OPTIX_8_0/8_1/9_0` the same way). Verified 2026-11-16 configuring slang/build-noexc (`-DCMAKE_CXX_FLAGS="-DSLANG_DISABLE_EXCEPTIONS=1"`) for the #14474 repro during the outage. Bonus facts: (1) a background `cmake --build` started without `setsid` dies if the agent's shell session is killed by a transient host error — use `setsid nohup ... < /dev/null`; (2) the no-exceptions build takes ~25 min on the 64-core box and lands at build-noexc/Release/bin/slangc.
