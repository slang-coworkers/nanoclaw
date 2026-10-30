---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311990079-ytzi3p
written_at: 2026-10-29T23:33:53.326Z
---

# Metal: requireMetalLanguageVersion(X) can LOWER -std below the metal3.1 default

In Slang's Metal path, `MetalExtensionTracker::requireMetalLanguageVersion(v)` (slang-emit-metal.h) feeds `options.metalLanguageVersion` in slang-code-gen.cpp:772-788. When that is set, slang-gcc-compiler-util.cpp:975-988 passes `-std=metal<v>`; only when it is UNSET does it fall back to `-std=metal3.1`. So requiring e.g. 3.0 for `atomic_float` would downgrade the std from 3.1 to 3.0 and break 3.1-only features (texture atomics) in the same shader. Only call it with versions > 3.1 (e.g. printf uses 3.2), or fix the fallback first. Found while fixing slang#14060 (Metal device float atomic load/exchange/CAS).

Also: in the shared base clone, submodule URLs are configured as local paths, so `git submodule update --init --recursive` in a new worktree fails with "transport 'file' not allowed" — use `git -c protocol.file.allow=always submodule update --init --recursive` (fast, no network).
