---
name: project_slang_rhi_818_metal_short_vector_assert
description: "slang-rhi#818 Metal short_vector index assert (exit 134) aborting slang-test in Slang macOS coverage CI — triaged to the shader-object/device layout-cache UAF, NOT the Metal backend; #811 is the only fix on that path and the pin is 13 commits behind it; 6 GitHub comments, verdict held through 5 corrections; PARKED on #811's author"
metadata:
  node_type: memory
  type: project
  title: slang-rhi#818 Metal short_vector assert
  tags:
    - slang-rhi
    - live-chain
    - use-after-free
    - coverage-ci
  originSessionId: a590b4f4-036c-40e6-9745-f5c5dafb17f8
---

# slang-rhi#818 — Metal `short_vector` index assert aborts slang-test in Slang's macOS coverage CI

Opened **2026-08-09 18:47Z** by `jvepsalainen-nv` (human MEMBER ⇒ real routing inbound, not a bot
echo). Routed to `slang-triager`; **no fixer dispatch** — the fix is an unfinished WIP PR owned by the
reporter and the submodule bump is a maintainer action. Labels applied `bug`+`CI`; `Metal`
deliberately withheld (it would assert the opposite of the verdict). Still unassigned, open.

## Verdict (held unchanged through five corrections)

Not the Metal backend. `tools/render-test/render-test-main.cpp:824` passes a **program-owned**
`TypeLayoutReflection*` into `Device::createShaderObjectFromTypeLayout`
(`src/device.cpp:788` at pin), which caches it in `m_shaderObjectLayoutCache`
(`src/device.h:473`) — a **raw-pointer key with no reference held**, lifetime = Device, and devices
persist process-wide. A stale/recycled layout desynchronizes the bound from the buffer at
`src/metal/metal-shader-object.cpp:237` (`m_slots[slotIndex + i]`, both operands from
`specializedLayout->m_bindingRanges`) ⇒ `index < m_size` fires.

**`src/metal/` in the assert path is an include artifact, not evidence.** `operator[]` is an inline
template member so `__FILE__` names the header; `src/metal/` declares only two `short_vector`s
(`metal-command.cpp:71-72`) and neither is referenced again. Reproduced the path string two ways
locally (direct `../core/` include; nested through `../rhi-shared.h` when `-Isrc` is absent) — clang
14/Linux/relative `-I`, **not** the Apple-clang CI config.

## The gate on the vulnerable call — the corrected mechanism

⛔**The `switch` at `render-test-main.cpp:808-822` is NOT a guard** — `default: break;` at
`:810-811` admits every `Kind`; the two `case` labels only *narrow* the layout at `:820`. The real
gate is one scope up, `assignObject`'s `if (typeName.getLength() != 0)` at **`:789`**: non-empty
takes the **safe** `createShaderObject(session, type, …)` branch; only the **`else` at `:801`**
reaches `:824`. `typeName` is filled only when the token after `new` is an identifier
(`shader-input-layout.cpp:639-641`).

⇒ **`new{…}` reaches the cache; `new SomeType{…}` does not.** Falsifiable per test, which the wrong
version was not.

## Planter set — 13 sites in 8 files (reproduced independently on both edges)

```
tests/compute/array-existential-parameter.slang
tests/compute/parameter-block.slang
tests/language-feature/dynamic-dispatch/constantbuffer-struct-interface-array.slang
tests/language-feature/dynamic-dispatch/constantbuffer-struct-interface-field.slang
tests/language-feature/dynamic-dispatch/global-interface-param-compute-mono.slang
tests/language-feature/dynamic-dispatch/global-interface-param-compute.slang
tests/language-feature/dynamic-dispatch/parameterblock-struct-interface-field.slang
tests/language-feature/types/opaque/inout-param-opaque-type-in-struct.slang
```

**Upper bound by source (not execution).** Safe-side count 84 occ / 41 files.
⚠️**My first count of 44/35 was WRONG** — globbed `*.slang` only (5 `.hlsl` files carry
`TEST_INPUT`) and anchored `=\s*new`, taking only the first `new` per line. Voided.

**Metal reachability is decided by an asymmetry in `_calcSynthesizedTests`, per `//TEST` DIRECTIVE
(not per file — `requirements` is read inside the loop at `slang-test-main.cpp:4730-4732`):**
- `:4740` — CUDA synth **requires** `explicitRenderApi == CPU`
- `:4780-4785` — non-CUDA (Metal) synth **forbids** any explicit API

⇒ a directive naming an API can get a CUDA variant and **never** a Metal one. Explicit-`-mtl` census
is **not** the filter (a file with zero `-mtl` still gets `syn (mtl)` — 1,166 such tests on 08-09,
1,060 on 08-07). Observed in job 93187440259: **3 with a Metal run · 1 (`inout-param-opaque…`) never
reached because the run truncated at the crash · 4 with no Metal variant.**
⇒ **Run all 8** — a false negative on a subset cannot distinguish "not the cause" from "I omitted the
planter."

## Evidence beyond the report (three findings that exist nowhere else)

Logs captured to the triager's `scratch-rhi818/` (~4.3 MB); **GitHub retention expires ~2026-08-16.**

- **Third crash signature:** `Assertion failed: new_data != nullptr` at `src/core/short_vector.h:582`
  — `malloc` in `grow()` with a garbage capacity. Prefix `src/core/`, a *different* TU.
- **Both truncation points:** 08-09 died in `language-feature/tuple/`, 08-07 in `generics/`;
  `language-feature/types/` = 0 in **both** (control `language-feature/` = 2,655) ⇒ nothing after each
  stopping point is measurable.
- ⭐**Strongest single datum:** `parameter-block.slang.4 (mtl)` **FAILS attempt 1 and PASSES attempt 2
  of the same job** (08-07 job 92756282838, att-1 boundary line 11222, att-2 hit `:14093`) ⇒
  order-dependence demonstrated **inside one run**, not inferred across two. Both of us initially
  filed this as counter-evidence.
- ⛔`SLANG_RHI_ASSERT` is **unconditional** (`src/core/assert.h:23`; `handleAssert` prints then
  `std::abort()`), so the exit-139 face is **not** "assert compiled out in Release." Only
  `SLANG_RHI_DISABLE_ASSERT_SCOPE()` suppresses it.

**Victim names in the report are SOUND and log-derivable** — the derivation is *the first variant that
printed no result line*, because `test-reporter.cpp:402-445` prints only after completion (the
`testStarted` print at `:460` is TeamCity-mode only; `##teamcity` = 0 in both logs). Cheaper still:
variant index = directive order, so `parameter-block.slang`'s fifth `//TEST` being the `-mtl` one
makes `.4` the Metal variant. See [[feedback_a_measured_zero_is_not_a_read_zero]] — I got this
backwards first and it reached the maintainer.

## Relation to other chains

- **slang#12320** (nightly coverage-macos **exit 139** segfault) — *not* a duplicate; two faces of one
  crash site, proven by **one job producing both**. #12320 never captured the assert face
  (`short_vector`/`Assertion`/`134` = 0 in its body+comments; control `139` = 18). Maintainer-owned:
  `jkiviluoto-nv`. See [[project_12320_coverage_macos_segfault_base_rate]].
- **slang-rhi#811** — the fix. See [[project_slang_rhi_811_shader_object_layout_cache_uaf]].
- **slang#12436** — open/blocked, carries the coverage workaround (`-synthesizedTestApi "-llvm-mtl"`
  **and** `-api "-mtl"` — **two** subtractions, the first only needed because synthesis would
  otherwise mint Metal variants). ⚠️**Master `:261` still reads `-synthesizedTestApi "-llvm"`**, so the
  issue's present-tense "now subtracts the API" is wrong; the revert target is a PR, not a commit.
- **slang-rhi#724** — adjacent Metal coverage-counter bug, same author.

## RESUME

🔵**PARKED on the author.** #811 is OPEN, head `3ef27be1`, `mergeStateStatus=BEHIND`, **WIP** since
08-05 13:28Z; slang's pin is `29dc332e55` (2026-07-06, #795) ⇒ `compare 3ef27be1...29dc332e55` =
ahead_by 0 / **behind_by 13**, so **no CI has ever exercised #811**.

- **The experiment:** land #811 → bump `external/slang-rhi` → run the 8 planters plus one `(mtl)`
  detector in one `slang-test` process → revert #12436's API subtraction.
- **CO-TRIGGER:** #811 merges ⇒ re-read the merged diff and check whether the pin bump rides with it.
- ⏱️**Only clock:** job logs expire ~**2026-08-16**; three findings above exist only in
  `scratch-rhi818/` after that.
- **6 comments posted** (`5233457880` verdict · `5233508306` · `5233538615` · `5233573641` ·
  ⛔`5233599063` **wrong, retracted** · `5233626707` retraction). GitHub footprint complete; the
  triager owns that surface, I posted nothing.
