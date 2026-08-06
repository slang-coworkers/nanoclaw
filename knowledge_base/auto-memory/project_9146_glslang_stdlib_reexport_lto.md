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

**GO GIVEN 2026-08-06** — jkwak-work (maintainer, webhook @nv-slang-bot, issue comment 5199055145): *"can you make a PR so that I can understand what you are describing? Without it, I am not sure what you are suggesting."* ⇒ the "await maintainer decision" gate is CLEARED. Dispatched slang-fixer on `gh-issue-shader-slang/slang-9146` for the Approach A version-script PR.

**Verified @49584a089 (2026-08-06) before dispatch — all four triage facts still hold:** `source/slang-glslang/CMakeLists.txt:19-39` still has `CXX_VISIBILITY_PRESET hidden` + `-Wl,--exclude-libs,ALL`; `release.yml:156` still `-DSLANG_ENABLE_RELEASE_LTO=ON`; `CMakeLists.txt:393` still defaults it OFF (was cited as `:371` in the posted triage — **line moved to 393**, same option); `cmake/SlangTarget.cmake:174-181` still sets `INTERPROCEDURAL_OPTIMIZATION_RELEASE/RELWITHDEBINFO`. **New fact that makes Approach A safe:** every exported symbol in `slang-glslang.cpp` is `extern "C"` + `visibility("default")` and every one is named `glslang_*` — `glslang_validateSPIRV`, `glslang_disassembleSPIRV`, `glslang_disassembleSPIRVWithResult`, `glslang_freeDisassembly`, `glslang_compile`, `glslang_compile_1_1/_1_2/_1_3`, `glslang_linkSPIRV` (9 total, lines 166/188/235/248/998/1037/1065/1080/1095). So `global: glslang_*; local: *;` covers the whole public ABI with no exceptions — no `slang_*` or C++-mangled export to enumerate.

**Next action:** slang-fixer owns the PR + the GitHub ack (closest-to-the-state). Fix must be empirically demonstrated, not just asserted: build with `-DSLANG_ENABLE_RELEASE_LTO=ON`, `nm -DC --defined-only` before/after. If the LTO hypothesis fails to reproduce, the fixer reports back rather than shipping a speculative version script.

## ⛔ 2026-08-06 — OUR PUBLISHED TRIAGE MECHANISM IS WRONG. Retraction owed on the issue.

slang-fixer could NOT reproduce: LTO ON, `nm` → 9 exports, 0 `std::` (positive control passed). **Bug is live though** — today's shipped `v2026.14.1` has 13 exports = 9 `glslang_*` + 4 leaked `std::__cxx11::basic_string::_M_{replace,assign,create,mutate}`. Leak set DRIFTS between releases (reporter saw 5 incl. `vector<uint>::_M_default_append` on v2025.23.1). Same package: `libslang-llvm.so` 26/31 `std::`, `libslang.so` 3/636, `libgfx.so` 1/14 — so this is NOT glslang-specific.

⭐⭐⭐ **The specific false claim we published (comment 5011400207): "LTO dissolves the archive boundary so glslang's `std::` instantiations escape `--exclude-libs`." Measured false — in our configure LTO never reaches the leaking code at all.** IPO is applied only by `slang_add_target`; glslang/SPIRV-Tools arrive via `add_subdirectory` (`external/CMakeLists.txt:319,336`), so: `-flto` in glslang compile cmds **0/256**, SPIRV-Tools-opt **0/207**, slang-glslang **2/263**. Object level: `libglslang.a` members have **0** `.gnu.lto` sections (43 total = control); our `slang-glslang.cpp.o` has 138/155. **Archives are ordinary objects ⇒ `--exclude-libs` localizes them fine.** The triage comment even called the LTO delta "the clincher" — that word was doing work no measurement supported.

⚠️ **Fixer's near-miss worth keeping: "`.localalias` proves LTO" is a DUD discriminator — present in both (95 mine / 97 released).** What discriminates is *which* symbols carry it: `.localalias` on `std::…basic_string::_M_*` = 0 mine / 3 released; leaked `GLOBAL DEFAULT` `std::…basic_string` = 0 mine / 8 released.

**What IS validated (arms share identical objects/archives, only the link flag varies):** arm1 `--exclude-libs,ALL` → 9 exports/0 `std::` · arm2 neither flag (leak instrument) → **6489/1371** incl. the issue's `vector<uint>::_M_default_append` · arm3 `--version-script` only → **9/0, all nine `glslang_*` still `T`**.
⛔ **LOGICAL GAP — do not overstate this A/B.** It shows the version script is *equivalent* to `--exclude-libs` in an env where `--exclude-libs` already works, and that both beat nothing. It does **NOT** show the version script works *where `--exclude-libs` fails* — the failing env was never reproduced. Provenance-independence is an argument from linker semantics (sound), not an experimental result here.

**Alternative B is dead, with a citation:** `libstdc++` declares `namespace std _GLIBCXX_VISIBILITY(default)` (`/usr/include/c++/12/bits/basic_string.h:53`); an explicit visibility attribute beats the `-fvisibility=hidden` default, so hiding glslang's compilation cannot hide `std::` instantiations. C (exclude MODULE from IPO) needs a new `slang_add_target` keyword, trades optimization for a visibility bug, and fixes none of the other leaking libs.

**Environment axes (I verified the runner myself, `release.yml:24`): CI = `ubuntu-22.04`.** Compiler axis per `.comment`: released .so GCC **11.4.0**, container GCC **12.2.0**. ⭐⭐ **But the LINKER axis is uncontrolled and is the better suspect — `--exclude-libs` is a linker feature, not a compiler one.** Container `ld` = **binutils 2.40**; original triage recorded reporter (clean) at **2.42**; ubuntu-22.04 ships 2.38 (⚠️ needs verifying, not measured). Monotone story fits: 2.38 leaks, 2.40/2.42 clean. ⇒ **Installing gcc-11 would NOT move binutils, so the proposed "close the loop with gcc-11" experiment is non-decisive as specified** — rejected on those grounds, not on cost.

**Ruling: ship (A)** — PR now with the mechanism restated honestly + an explicit retraction of the published LTO claim on the issue. jkwak asked for a diff to evaluate, not compiler forensics. Cheap decisive strengthener offered (time-boxed, non-blocking): force `-flto` onto glslang's *own* compilation to manufacture the condition triage hypothesized; if that makes `--exclude-libs` fail, re-test the version script against it → yields the real "works where exclude-libs fails" result, in-container, no approval needed.

**Memo:** triager sent full digest (file:line @HEAD aaa07fe29, repro, 3 approaches, sources) — inbox/a2a-1784380730206-1qcnt5/triage-9146.md (triager filesystem; delivered via send_file 2026-07-18).
