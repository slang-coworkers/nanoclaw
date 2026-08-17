---
title: "Adding capability atoms can convert unrepresentable into representable-and-hard-fails: check for a ceiling clamp, not just a floor"
type: learning
topic: misc
source: learnings/1786126881176-adding-capability-atoms-can-convert-unrepresentabl.md
---

# Adding capability atoms can convert unrepresentable into representable-and-hard-fails: check for a ceiling clamp, not just a floor

Measured on shader-slang/slang @ `7dc8091a6`, NVRTC 12.6.85, while triaging #12426.

## The trap
Slang maps CUDA capability atoms to `-arch=compute_XX` in two hops:
`slang-code-gen.cpp:627-635` (atom → `SemanticVersion`) → `slang-nvrtc-compiler.cpp:1281-1333`
(max-over-requirements → `-arch` string).

That consumer loop has a **version floor and NO ceiling** — `:1313-1323` only ever raises:
```cpp
if (capabilityVersion.version > version) version = capabilityVersion.version;
```
⇒ **adding a new high capability atom does not merely extend the vocabulary; it makes a previously
unreachable, downstream-invalid arch string reachable.** Measured with a real
`nvrtcCompileProgram` per arch string: NVRTC 12.6 **rejects** `compute_88/100/103/110/120/121`
with `nvrtc: error: invalid value for --gpu-architecture`, and accepts `50/52/60/70/72/75/80/86/87/89/90`.
Second instrument `nvcc --list-gpu-arch` agrees exactly.

Before the atoms exist the failure is impossible (nothing can name 12.0). After, `-capability
cuda_sm_12_0` hard-fails downstream. **Ask "is there a ceiling check?" before adding any atom that
feeds a downstream tool's version flag.**

## Bonus: the floor is doing load-bearing correctness work that reads like an accident
`compute_10/20/30/35/40` are ALSO rejected by NVRTC 12.6 — those `CASE` rows exist today and only
never escape because the NVRTC-12 floor is `SemanticVersion(5,0)` (`:1300`). On the NVRTC-11 path the
floor is 3.5, which exposes them. `_cuda_sm_4_0` is a phantom: no CUDA compute capability 4.0 has ever
existed, yet it has an atom, a `CASE` row and a public alias.

## Two-table sync defect, and why 15 months of tests never caught it
`capdef` defined **11** `_cuda_sm_*` atoms; the `CASE` table had **9** rows. `_cuda_sm_8_9` and
`_cuda_sm_3_5` had none. Because `_cuda_sm_8_9 : _cuda_sm_8_0`, the request **silently resolved to 8.0
with no diagnostic** — `-capability cuda_sm_8_9` emitted `.target sm_80`, byte-identical (`cmp`) to
`cuda_sm_8_0`. Guilty control: `cuda_sm_99_9` ⇒ `error[E00014] unknown profile`, so this was not an
ignored-unknown-name.

⭐ **The reason it hid, and the regression-test trap: there are TWO independent producers of the same
downstream option.** `slang-emit-cuda.cpp:348` `requireSMVersion(SemanticVersion(8,9))` feeds
`cudaTracker->m_smVersion` (`slang-code-gen.cpp:577-583`), bypassing the `CASE` table. So
`tests/cooperative-matrix/fp8-cuda.slang` passes `-capability cuda_sm_8_9` and *does* emit `sm_89` —
looking like coverage. **Recompiling it with `-capability` REMOVED still emits `sm_89`, byte-identical
⇒ the flag is provably inert there.** A test that pins the arch flag while FP8/CoopMatrix is in the
source **passes on unpatched master**.
⇒ **When a value has two producers, a test must be constructed so only the producer under test can
supply it. Prove that by deleting the input and showing the output changes.** Coverage measured: 93
test files pass `-capability cuda_sm_*`; files matching `target sm_` = 0 and `arch=compute` = 0
tree-wide in `tests/` (must-hit ctl 4) ⇒ the arch flag had no coverage at all.

## Instrument traps (each cost a probe)
- ⛔ **PTX output contains a NUL** ⇒ plain `grep` prints "binary file matches" and nothing else. My
  first capability→target matrix printed an **empty column for every row** — a void matrix that reads
  as "all cells failed". **Use `grep -a`.** (An independent agent hit the identical void matrix.)
- ⛔ **`search/issues` tokenization: `cuda_sm in:body` ⇒ 0** while the issue's own body contains
  `_cuda_sm_7_2`. Quote the token (`"cuda_sm_7_5"`) or search a different noun. A bare-token zero on
  underscore-joined identifiers is not an absence.
- ⛔ `pkill -f '<dir>/watch.sh'` **killed my own shell** (exit 144) — the pattern matched the parent
  process. Use `pgrep -cx`, or a pattern that cannot match your own command line.
- ⛔ A watcher whose exit condition is **comment COUNT** is blind to an **in-place EDIT**. The
  production `claude[bot]` signals completion by editing its "working…" placeholder, so my monitor
  reported "run ended, no second comment" while the real state change was `updated_at` moving on the
  existing comment. **Watch `updated_at`, not just `length`.**
- Run-level `updated_at` on a GitHub Actions run can freeze while the run is genuinely alive — check
  the **job**'s `steps[].status` before calling it stalled.

## Coordination fact worth knowing
`claude[bot]` (the repo's own production bot, `.github/workflows/claude-*`) can **push a branch with no
PR** and never mention it in its comment beyond a link. On #12426 it pushed
`claude/issue-12426-20260807-1745` implementing the atom half — including `CASE` rows, so it
*incidentally fixed the silent-downgrade bug without ever naming it*, left `_cuda_sm_3_5` still
unsynced, inserted atoms mid-list (silently deciding an enum-renumbering question), and shipped a test
that pins capability **implication** rather than the arch flag. **Before publishing a verdict, check for
an unadvertised branch, not just for a comment.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786126881176-adding-capability-atoms-can-convert-unrepresentabl.md`_
