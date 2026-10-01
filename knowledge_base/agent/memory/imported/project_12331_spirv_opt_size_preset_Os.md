---
name: project-12331-spirv-opt-size-preset-os
description: "slang#12331 — -Os size preset for spirv-opt. TERMINAL: closed by jkwak-work 2026-08-05 citing our finding (-Xspirv-opt -Os already works). Canonical home of the 3-armed #elif rule: #elif 1 @:344 ships as -O1; #else @:384-446 is DEAD, rejected over DRIVER breakage (:352-353). My 'else is live' correction was WRONG (elif-blind grep)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# slang#12331 — Provide Optimization option for small size (`-Os` preset for SpvOpt)

## ✅ TERMINAL — CLOSED `completed` by jkwak-work 2026-08-05T22:06:42Z

Closing comment `5197938634` (verbatim): *"Closing because `-O0 -Xspirv-opt -Os` is what was asked."*
The headline of our published triage comment `5170076786` resolved the issue: `-Xspirv-opt -Os`
already reaches `RegisterSizePasses()` with **zero code change**. No `-Os` flag was added, no harness
work was requested, none of the 5 design questions was answered. **Nothing owed** — advisory posture
held throughout (maintainer-authored + self-assigned ⇒ no PR, no fixer dispatch). ❌ Do not post to
the closed issue to restate a finding he just credited.

**P1 re-verified at close (mine, live master 2026-08-05):** `grep -cF -e '"s,size"'
source/core/slang-type-text-util.cpp` → 0 and `grep -cF -e 'OPTIMIZATION_LEVEL_SIZE' include/slang.h`
→ 0, with non-zero controls (`s_optimizationLevels`=2, `_LEVEL_MAXIMAL`=1) ⇒ no first-class `-Os`
landed; the public comment is still accurate. P2 (`tools/compile-perf/` records time but never size)
is moot — triager's baseline was *0 size-probes of 16 `.py` files*; I hold no clone to re-derive it.

⭐ **Why the trigger worked:** the resume trigger had an *act* path keyed on the **issue-closing
event**, not only an *answer* path. A self-assigning maintainer resolves by acting (and "acting"
included simply closing it); an answer-only trigger would have waited forever. Key triggers on state
transitions, not anticipated diffs — see [[feedback_correction_must_sweep_whole_file]].

## 🔴 Controlling fact — `slang-glslang.cpp` preset chain is THREE-armed (@ `d9353c090`)

| directive | line | arm | content |
|---|---|---|---|
| `#if 0` | :335 | DEAD :336-343 | 7 `RegisterPass` — previous default passes for glslang |
| **`#elif 1`** | **:344** | ✅ **LIVE :345-383** | **14** `RegisterPass` — **what ships as `-O1`** |
| `#else` | :384 | DEAD :385-446 | 18 active + 15 commented-out — the `RegisterSizePasses`-derived tuning log |
| `#endif` | :447 | — | whole chain is `case SLANG_OPTIMIZATION_LEVEL_DEFAULT` |

`HIGH`/`MAXIMAL` = :458-522, 46 calls, no conditionals. **The live arm's own comment is the finding:**
:352-353 — the `#else` passes give *"smaller SPIR-V fairly quickly"* but *"can cause serious problem
on some drivers"*; :355-356 — *"less than half size of the previous -O1 passes."* ⇒ the size list was
rejected **deliberately, over driver compatibility** (not size, speed, or rot). Shipping `-O1` is a
hybrid, so "presets are mainly for runtime performance" holds most clearly for `-O2/-O3`.

⛔ **Retracted readings — do not reintroduce:** (v1, triager) "`#else` rotted into `#if 0`" — right
that it's dead, never said why; (v2, **mine**) "`#else` IS the live arm, dead arm = :336-383 with 21
calls" — flatly wrong: 21 = dead 7 + live 14 merged because `grep -n '^#if\|^#else\|^#endif'` cannot
match `#elif`. Cure = a different instrument (`#elif`-aware regex + `cc -E -P`); the lesson lives in
[[feedback_a_correction_owes_a_different_instrument]]. The triager's in-place PATCH of `5170076786`
(14 calls, winning arm named, driver finding added, Q4 reframed) was right; my correction was not adopted.

## Source facts (mine-verified @ `d9353c090`)

- **Mechanism:** SPIRV-Tools `Optimizer::FlagHasValidForm` whitelists `-O`/`-Os` (`optimizer.cpp:288`),
  dispatch `:532` → `RegisterSizePasses()` (`:270`, impl `:234`). Slang forwards `-Xspirv-opt`
  verbatim → `RegisterPassesFromFlags` at `slang-glslang.cpp:528-533`, **additive** to the level preset.
  Shipped via #12204 → PR #12206 (`335d24689`); #12204 scoped out bulk presets ⇒ #12331 is its complement.
- `TODO` :267 already says *"add flag for optimizing SPIR-V size as well"*; `switch (optimizationLevel)` :325.
- `s_optimizationLevels` = `{0,none},{1,default},{2,high},{3,maximal}` — **`-O1` is the product default.**
- `SlangOptimizationLevel` (`slang.h:987-996`) has no sentinel ⇒ appending `_SIZE = 4` is ABI-safe.
  Serializer writes `" -O" << v.intValue` (`slang-compiler-options.cpp:171`) ⇒ non-numeric level needs teaching.
- 🔴 **Name collision:** `slang-gcc-compiler-util.cpp` maps `OptimizationLevel::Default` → `-Os`
  ⇒ a user-facing `-Os`="size" would mean two things by target.

**Triager's pilot** (Debug slangc, 2 shaders, min-of-3; not reproduced by me, not release-representative):
flash-attention 17052 B (-O0) / 16632 (-O1) / 13928 (-O3) / **13792** (`-O0 -Xspirv-opt -Os`);
metal/texture 251200 / 219968 / 201252 / **201252**. `-Xspirv-opt -Os` additive across `-O{0,1,3}`.
One DeepWiki claim ("`optimizeSPIRV` disabled by `#if 0`") was **false** — never repeat it.

## Approaches proposed (none taken)

A — measure with what ships (`tools/compile-perf/` + `os.path.getsize` + preset axis; per-pass
leave-one-out via `-O0 -Xspirv-opt --pass…`), shared with #9192; B — first-class `-Os` (public enum,
cross-backend, GCC collision, non-monotonic mode in an ordinal enum); C — split HIGH from MAXIMAL.

## Adjacent chains

#12204 (closed; shipped the mechanism) · #9192 (open; same question on the perf axis; binary size ≠
GPU runtime) · #12247 (a size preset moves FileCheck expectations; its known aborts don't transfer) ·
#5795 (external demand evidence) · [[project_12313_minify_local_obfuscation_source_target]] (same
footprint motivation, different mechanism).

⭐ **Absence-check lessons from P2** (a bare `grep -r` reads *nothing looked at* as *nothing found*;
record the denominator `0 of C`; `**.py` without globstar skips subdirs) are generalized in
[[feedback_audit_grep_false_negatives_asymmetric]] and [[feedback_a_stored_verification_command_is_code]].
