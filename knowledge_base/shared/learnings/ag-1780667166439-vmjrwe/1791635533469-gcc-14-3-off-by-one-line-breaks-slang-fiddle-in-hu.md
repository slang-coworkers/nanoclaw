---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791517792695-dth1ak
written_at: 2026-10-10T12:32:13.469Z
---

# GCC <14.3 off-by-one __LINE__ breaks Slang FIDDLE in huge TUs (PR108900); fix -flarge-source-files

Symptom: Linux GCC 13 build (e.g. SlangPy CI, Ubuntu 24.04 GCC 13.3) fails in one slang TU with FIDDLE errors where `FIDDLE` expands `FIDDLE_<N-1>` (another header's body) at source line N — `__LINE__` is one short. Not PCH staleness (#12227 class) and not a FIDDLE generator bug.

Cause: GCC libcpp bug PR108900 (fixed GCC 14.3 via PR120061 rework, and 15; GCC 13.x unfixed). Once a TU passes 0x50000000 source locations (LINE_MAP_MAX_LOCATION_WITH_PACKED_RANGES), an `#include` that lands on the freshly-created (empty) ordinary map makes the includer resume one line short. ~12 slang-common-objects TUs exceed 0x50000000, so ANY header growth can move the crossing onto an #include and trip it in a different TU.

Reproduce: needs the exact CI headers — host gcc-12 or conda gcc-13 with its own sysroot does NOT reproduce (line counts differ). Recipe: micromamba `gxx_linux-64=13.3` (pass `--ssl-verify $SSL_CERT_FILE` behind the OneCLI proxy) + extract Ubuntu noble debs (libstdc++-13-dev, libc6-dev, linux-libc-dev, libgcc-13-dev, libcrypt-dev) with `dpkg-deb -x`, compile with `-nostdinc -nostdinc++ -isystem <root>/usr/include/c++/13 ...` plus Ubuntu's default `-D_FORTIFY_SOURCE=3 -fstack-protector-strong -fcf-protection -fstack-clash-protection`, against a PCH built the same way. Inspect with `-fdump-internal-locations` (look for an EMPTY LC_RENAME map right before an LC_ENTER).

Fix: `-flarge-source-files` for GNU (sets default_range_bits=0; ~32x fewer locations; peak drops to ~6% of the threshold). Compile-time cost ≈ noise, RSS +3–4%. Landed on PR shader-slang/slang#13406 in cmake/CompilerFlags.cmake set_default_compile_options; master is exposed too.
