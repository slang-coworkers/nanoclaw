---
type: triage
---
# Triage: shader-slang/slang#14632 — Linux: NVRTC is not found when only the CUDA runtime packages are installed
Date: 2026-11-19 | Category: bug | Severity: medium | Priority: P2 | Component: target-emit (CUDA/PTX — downstream compiler loading)

## What's broken
On Linux, `NVRTCDownstreamCompilerUtil::locateCompilers` tries only the unversioned
`libnvrtc.so` (via `loadSharedLibrary("nvrtc")`, slang-nvrtc-compiler.cpp:1732). The fallback
`_findAndLoadNVRTC` (slang-nvrtc-compiler.cpp:1669-1707) is entirely `#if SLANG_WINDOWS_FAMILY &&
SLANG_PTR_IS_64` — the non-Windows `#else` (L1690-1696) does nothing and returns `SLANG_E_NOT_FOUND`
(comment at L1704-1705 documents the false assumption). `libnvrtc.so` exists only with
`cuda-nvrtc-dev-*` (full toolkit); runtime-only installs (CUDA container images, `cuda-nvrtc-12-8`,
Ubuntu `libnvrtc12`, pip `nvidia-cuda-nvrtc` wheels) ship only versioned sonames
`libnvrtc.so.12` / `.13` / `.11.2`. So `-target ptx` fails with E00100/E52002 on machines with a
working NVRTC. `docs/cuda-target.md:47` overclaims ("this should be enough... latest version").
NOT a regression — never worked on Linux; the docs line was aspirational.

## Repro
Reporter's (0z5a) validated matrix, 7 environments, slangc built from main a22c1420:
`docker run --rm -it nvidia/cuda:12.8.1-runtime-ubuntu24.04 bash; slangc k.slang -target ptx`
→ fails (exit 2, E00100/E52002); with candidate fix → writes PTX. `-nvrtc-path libnvrtc.so.N`
works in every row (workaround). Candidate fix on fork: 0z5a/slang@a29bcef (no PR yet, CLA pending).
Local (this container): could NOT stage the runtime-only env (no docker; system CUDA install is a
dev install with `libnvrtc.so` present — not vandalized). Mechanism verified: control
`slangc k.slang -target ptx` works; `slangc k.slang -target ptx -nvrtc-path libnvrtc.so.12` works
(exit 0) — proving `appendPlatformFileName` (source/core/slang-platform.cpp:352-373) passes
names containing ".so." through to dlopen unchanged, so versioned-soname loads need NO core changes.
Label: `reproduced` NOT applied (not locally reproduced per policy); limitation noted in comment.

## Codebase digest (file:line)
- `source/compiler-core/slang-nvrtc-compiler.cpp:1709` — locateCompilers; `-nvrtc-path` takes
  precedence at L1718-1721; plain `"nvrtc"` try at L1732; fallback call L1733-1736.
- `slang-nvrtc-compiler.cpp:1669-1707` — `_findAndLoadNVRTC`; Windows-only machinery (NVRTCPathVisitor
  L410-606, `_findNVRTC` L627-706, newest-first L1680-1688); `#else` L1690-1696 = no-op → E_NOT_FOUND.
- `source/core/slang-platform.cpp:352-373` — `appendPlatformFileName`: ".so." names pass through.
- `-nvrtc-path` plumbing: `source/slang/slang-options.cpp:4497`, `slang-global-session.cpp:954-959`,
  consumed `slang-check.cpp:133-136`.
- Precedent for multi-name try: `_canLoadSharedLibrary("vulkan-1") || ...("vk_swiftshader")`
  (source/core/slang-render-api-util.cpp:262-272). slang-rhi glob-scans `libnvrtc.so*`
  (external/slang-rhi/src/cuda/cuda-nvrtc.cpp:152-176, 202-216).
- Tests: none cover lookup; `tests/downstream/get-downstream-compiler-path.slang`,
  `tools/slang-unit-test/unit-test-downstream-compiler-path.cpp:39-57` touch `-get-nvrtc-path` only.

## Candidate approaches
### Approach A: versioned-soname fallback loop in the non-Windows `#else` (reporter's fix)
- Where: `slang-nvrtc-compiler.cpp:1690-1696` (#else of `_findAndLoadNVRTC`) + `docs/cuda-target.md:47`.
- Delta: after `libnvrtc.so` fails, try `libnvrtc.so.13`, `libnvrtc.so.12`, `libnvrtc.so.11.2`
  newest-first; `-nvrtc-path` unaffected (precedence at L1718); dev installs unaffected (first try wins).
- Tradeoffs: ~10 lines; hardcoded list must grow for CUDA 14+ (mitigate: descending loop from a
  named constant max major, e.g. 15→11, with cu11's `.11.2` spelling as the list tail); 3 extra
  "failed to load dynamic library" notes when no NVRTC exists at all (cosmetic, acceptable).
- Risk: low — validated across 7 environments by reporter.
### Approach B: Linux directory-scan discovery (model on Windows `_findNVRTC` / slang-rhi glob)
- Where: new visitor machinery in slang-nvrtc-compiler.cpp scanning /usr/local/cuda*/lib64, ldconfig
  dirs; glob `libnvrtc.so*`, sort by version, newest-first.
- Delta: future-proof (finds CUDA 14+ without list updates).
- Tradeoffs: large new platform code (~100+ lines), duplicates Windows machinery, fragile
  glob/parse, bigger review surface; macOS (no CUDA) needs guarding.
- Risk: medium — complexity and blast radius out of proportion to the gap.
### Approach C: parse `ldconfig -p` / env (CUDA_HOME) at lookup time — variant of B; rejected:
spawning processes or parsing distro caches from a compiler lookup is fragile and slow.

## Recommended path
Approach A — fastest correct fix, no core changes, matches reporter's validated fork commit
(0z5a/slang@a29bcef) so an eventual reporter PR (post-CLA) diffs cleanly against ours. Implement as
a small static candidate list (or bounded descending-major loop) in the `#else` branch; update
`docs/cuda-target.md:47` to describe the versioned fallback; consider suppressing the per-name
"failed to load" notes when all candidates fail (optional). Approach B stays available if
maintainers want future-proofing.

## Acceptance criteria
1. Runtime-only install (`libnvrtc.so.12` or `.13` only): `slangc k.slang -target ptx` succeeds
   without `-nvrtc-path`.
2. `-nvrtc-path` precedence and dev-install (`libnvrtc.so` present) behavior unchanged.
3. No-NVRTC machine still fails with clear diagnostics (extra per-name notes acceptable).
4. `docs/cuda-target.md` updated.

## Sources
- Local code read: slang-nvrtc-compiler.cpp, slang-platform.cpp, slang-render-api-util.cpp,
  slang-rhi cuda-nvrtc.cpp (subagent digest, 2026-11-19).
- DeepWiki: "Downstream Compiler Integration" — confirms Windows-only fallback, `-nvrtc-path`
  exclusive semantics, diagnostic-wrapping retry loader.
- Reporter's package survey + repro matrix (issue body); no duplicate issues
  (gh search "nvrtc" all-state, 2026-11-19).
- Shared wiki: slang-backends-cuda-nvrtc-vs-offline-nvcc.md (L40S CUDA 12.6 runtime checks),
  spirv/glslang loader notes (dlopen name mechanics).
