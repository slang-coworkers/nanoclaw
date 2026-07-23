---
name: project-9146-glslang-stdlib-reexport-lto
description: "slang#9146 C++ stdlib symbols re-exported in libslang-glslang release pkgs — triaged, parked, LTO-defeats-exclude-libs"
metadata: 
  node_type: memory
  type: project
  originSessionId: b25f6e67-6a1c-4749-83cf-0a1af0f72a96
---

shader-slang/slang#9146 — C++ stdlib symbols re-exported in release packages of libslang-glslang.

**State:** TRIAGED + verdict posted (issue comment 5011400207), PARKED — not forwarded to slang-fixer. Maintainer jkwak-work requested triage only (webhook @nv-slang-bot 2026-07-18); assigned to jkwak-work. Reporter NBickford-NV (contributor).

**Classification:** bug (regression) / low severity / build-system·release-CI / P3.

**Root cause (HIGH-confidence hypothesis, config-evidenced, NOT empirically reproduced):** Release CI enables LTO (`release.yml:156` `-DSLANG_ENABLE_RELEASE_LTO=ON`, added ~2025-06 commit 7f04adbfb — matches leak reappearance). Local `cmake --workflow --preset release` is LTO-OFF (default `CMakeLists.txt:371`) → clean. `-Wl,--exclude-libs,ALL` localizes by originating static archive; under LTO the archive boundary dissolves so glslang's `std::` template instantiations escape localization and leak with default visibility. The #7722/#8089 symbol-hiding fix is present & un-reverted — *defeated* by LTO, not removed. Reporter's clean local build shares same OS/GCC 13.3/binutils 2.42 → only verified delta is LTO.

**Recommended fix (bot-PR-able, in-tree):** Approach A = explicit linker version script on slang-glslang (`global: glslang_*; local: *;`), LTO-immune, minimal. Alts: B `-fvisibility=hidden` on glslang compilation; C exclude MODULE from IPO (`SlangTarget.cmake:174`). Choice among 3 is a build-config design call left to maintainer.

**Next action:** await jkwak-work decision. If maintainer/operator says go, dispatch slang-fixer for Approach A version-script PR. NEVER auto-open without that word.

**Memo:** triager sent full digest (file:line @HEAD aaa07fe29, repro, 3 approaches, sources) — inbox/a2a-1784380730206-1qcnt5/triage-9146.md (triager filesystem; delivered via send_file 2026-07-18).
