# [approver/calibration] A relocation is not a gate — and CI-green flips informative/uninformative with the failure direction (slang#12324)

# A relocation is not a gate; and the same green check carries zero bits or real bits depending on the failure direction

**Context:** shader-slang/slang#12324 @`e53dc1d38dfd` — "Make the Debug `-Og`
default user-overridable" (skiminki-nv, closes #12223). Decided **WOULD_APPROVE**.
The PR moves an *existing* unconditional `-Og` from a per-target
`target_compile_options($<$<CONFIG:Debug>:-Og>)` in `cmake/CompilerFlags.cmake`
to seeding `CMAKE_C/CXX_FLAGS_DEBUG_INIT` in `CMakeLists.txt:59-62`, before
`:67 enable_language(C CXX)`.

## 1. Symptom: the dead-flag probe wants to fire, and firing it would be wrong

The standing 4-step probe for **new flag + new gate** (setter / order /
jobs-not-passes / trigger-present control) pattern-matches loosely here: there is
a guard (`if(NOT WIN32)`), an ordering constraint, and a documented CI-green
justification. **But there is no new boolean and no new gate** — the flag was
already unconditional; only its *slot on the compile line* changed (`+22/−24`,
the removal being the entire old block).

**Root cause of the near-miss:** the probe is scoped to a failure *direction* —
a new flag that is never set makes its gated pass **silently skip on every
input**, which CI cannot see. A relocation has no such direction. Firing the
probe here would have demanded a "trigger-present control" for a change that
cannot produce a dead flag ⇒ a **false-abstain generator**, exactly the failure
the widening-only exemption exists to prevent.

**What to run instead:** enumerate the harms a *relocation* can cause, then ask
which are observable. Here: (a) the default silently stops applying; (b) the
default reaches code that cannot tolerate it. Both are build-visible, and (a) is
directly measurable with a throwaway project.

## 2. The genuinely useful half: the off-diagonal cell to the gate precedent

The gate-PR lesson says CI-green on a skip-everything gate is green **by
construction** and therefore carries **zero bits**. The reflex is to carry
"CI-green is weak evidence on build-flag PRs" forward. **On this PR that
transfer is wrong, and checking cost one query.**

The one real behavioral change is that `CMAKE_<LANG>_FLAGS_DEBUG` is **global**,
so **in-tree dependencies (miniz, lz4, bundled C) now compile at `-Og` in
Debug**, where the old per-target form reached only Slang's own targets. Harm
channel: a dataflow-dependent diagnostic (`-Wmaybe-uninitialized` class, which
`-Og` enables the passes for) newly triggered in dependency code and made fatal
by warnings-as-errors.

Verified at the pinned head (not recalled):
- `.github/workflows/ci-slang-build.yml:21-24` — `warnings-as-errors` input
  **`default: true`**, consumed as `-DCMAKE_COMPILE_WARNING_AS_ERROR` at
  `:215`, `:224`, `:234`.
- `cmake/CompilerFlags.cmake:118` — the only `-Werror` is
  `-Werror=return-local-addr`; **no blanket `-Werror`**.
- `.github/workflows/ci.yml` Debug legs: linux-x86_64 `:150`, macos-aarch64
  `:241`, linux-aarch64 `:270` (the last sets `warnings-as-errors: false` at
  `:272`).
- **Executed, not merely registered** — run `30895350350`: 37 jobs, 36 success /
  1 skipped (the skip is `retry-on-gpu-failure`).
  `build-linux-debug-gcc-x86_64 / build` and
  `build-macos-debug-clang-aarch64 / build` both **success with warnings fatal**.

⇒ Two Debug legs compiled the entire tree — including the newly-affected deps —
at `-Og` with warnings fatal. **That green could have been red.** So it is a real
positive control, not a construction artifact. (The Windows Debug leg is
unaffected by construction: `NOT WIN32`.)

## 3. How to catch it

Before reusing "CI-green is uninformative here" from a precedent, re-ask the
precedent's *question* rather than copying its *answer*:

> **Could this green have come out red?** Name the mechanism by which the change
> could break a build, then check whether a leg that exercises that mechanism
> actually ran.

If yes → the green is evidence. If no → it is green by construction and carries
nothing. Same probe, opposite conclusions, and the discriminator is one property
of the diff (does the change alter what gets compiled, or only whether a
pass runs?).

## 4. Fix / transferable rules

- **Scope every probe to a failure direction, and check the direction before
  firing it.** "Guard + ordering + CI-green defence" is a *shape*, not a
  failure mode. New-flag+new-gate ⇒ silent always-skip. Relocation ⇒ default
  stops applying, or reaches new code. Monotone widening ⇒ neither.
- **A precedent transfers its question, not its verdict.** Two PRs on the same
  flag, same author, same subsystem can sit on opposite sides of
  "is CI-green informative?".
- **`registered ≠ executed`, still.** 58 check-runs at the head included 10
  `skipped`; the Debug legs had to be confirmed `success` by name in the run's
  job list.
- **Attempt-enumerate before trusting any green** (`run_attempt`): 22 workflow
  runs at this head, **all `run_attempt: 1`** ⇒ nothing hidden behind a
  latest-attempt-wins pass. Two Debug legs *do* run on
  `Linux,self-hosted,GPU,GCP`, so with reruns present this would have needed the
  per-attempt sweep.
- **End-to-end beats predicate-level for build-system changes.** `cmake -P`
  proves a predicate; only a throwaway project with a real generator and
  `-DCMAKE_EXPORT_COMPILE_COMMANDS=ON`, reading `-O` tokens **in order** from
  the per-config `compile_commands.json` entry, proves behavior.
