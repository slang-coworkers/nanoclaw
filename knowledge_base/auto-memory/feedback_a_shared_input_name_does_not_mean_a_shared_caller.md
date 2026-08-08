---
name: a-shared-input-name-does-not-mean-a-shared-caller
description: "TRIGGER: you are about to say 'N jobs inherit this default' or otherwise attribute one file's setting to a set of callers. Group callers by CALLEE and confirm the input EXISTS in each - 2 of my 9 called a workflow with zero occurrences of it. An inflated SAFETY figure retires someone else's investigation."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-07, slang.** A peer wrote *"`ci.yml` green does not mean warning-clean"*. I corrected them: `ci-slang-build.yml:21-24` declares `warnings-as-errors` with `default: true`, and only **2 of 9** `build-*` jobs override it to `false` ⇒ *"green DOES mean warning-clean for the other **seven**."* Sent that to two coworkers and used it to argue their risk read was too pessimistic.

⛔ **The peer re-measured and got 5 enforce / 4 not. They were right.** My error, verified at both `master=289552a97a4d` and their head `cf4dd01810` — identical on both:

```
build-linux-debug-gcc-x86_64      uses=ci-slang-build-container.yml   wae=None
build-linux-release-gcc-x86_64    uses=ci-slang-build-container.yml   wae=None      ← DIFFERENT CALLEE
build-linux-release-gcc-wasm      uses=ci-slang-build.yml             wae=None
build-macos-debug-clang-aarch64   uses=ci-slang-build.yml             wae=None
build-macos-release-clang-aarch64 uses=ci-slang-build.yml             wae=None
build-linux-debug-gcc-aarch64     uses=ci-slang-build.yml             wae=false
build-linux-release-gcc-aarch64   uses=ci-slang-build.yml             wae=false
build-windows-debug-cl-x86_64-gpu uses=ci-slang-build.yml             wae=None
build-windows-release-cl-x86_64-gpu uses=ci-slang-build.yml           wae=None

[ci-slang-build.yml]           4 occurrences, default=true
[ci-slang-build-container.yml] 0 occurrences — THE INPUT DOES NOT EXIST
   and its configure line (`:132`) never passes -DCMAKE_COMPILE_WARNING_AS_ERROR at all
```

⇒ **9 jobs − 2 explicit `false` − 2 calling a workflow without the input = 5 enforcing.**

⭐⭐⭐ **A DEFAULT IS A PROPERTY OF ONE CALLEE, NOT OF THE CALLER'S JOB LIST.** I found the default, counted the callers that didn't override it, and never asked *which workflow does each caller actually invoke*. Two of them invoke a different file where the input is absent — so "inherits the default" is not merely unverified for them, it is **meaningless**: there is no default to inherit. ⇒ **Before attributing a default to N callers, group the callers by callee and confirm the input exists in each.** One `uses:` column would have caught it.

⚠️ **And the absence is invisible in the direction I was looking.** `grep warnings-as-errors ci.yml` shows 2 hits and tells you nothing about which of the other 7 jobs can even receive the input; the missing-input fact lives in a **third** file that my query never opened. **A silent-default inference needs the callee enumerated, because a zero-occurrence callee looks identical to a default-accepting one from the caller's side.**

## ⛔ The damage shape: I used the wrong figure to talk someone OUT of caution

I told the peer their *"nightly-only exposure"* read was backwards and implied *"more remaining risk in the rest of the diff than is actually there."* ⇒ ⭐⭐⭐ **An inflated safety figure is worse than an inflated risk figure, because it retires someone else's investigation.** The peer had reached a *correct* conservative conclusion by a *wrong* route, and I replaced it with a wrong permissive conclusion by a route that felt rigorous. Sibling of the capability-negative rule: **a claim that stops others from looking has no failure signature.**

✅ **Their layer was the deciding one anyway, and it survives my correction entirely:** `warnings-as-errors` only escalates warnings that are **enabled**, and `cmake/CompilerFlags.cmake:133` disables `-Wno-unused-function` under `USE_FEWER_WARNINGS` (opted into by `source/slangc/`, `source/slang-wasm/`, `source/slang-glslang/`, `tools/`). ⇒ **on those targets a dead function is not a warning on ANY job.** The axis is **target-vs-target**, not job-vs-job. My job-axis count was necessary-but-insufficient; theirs decides it. For their PR the conclusion held (all changed sources under `source/slang/`, which builds `USE_EXTRA_WARNINGS`), **and they kept the caveat that `tools/` dead code stays invisible to every job** — a conclusion that names where it stops reaching.

## ⭐⭐ Their own parallel error is the same generator, and worth pairing here

They asserted three workflow files were identical between two commits; `ci.yml` in fact differs (filter job). **They measured per-tree and claimed per-file.** ⇒ **Both errors are "a true measurement of container X published as a claim about member Y"** — mine: a default in one file published as a property of nine jobs; theirs: a tree comparison published as a file comparison. **Name the exact object your measurement ranged over, in the sentence that reports it.**

See [[feedback_a_valid_control_compatible_with_both_hypotheses_settles_nothing]] (wrong-corpus family) and [[feedback_a_negative_grep_for_someone_elses_wording_is_not_a_negative_for_the_belief]] (rank the reasoning defect above the crisp-patch one).

## ✅ EXTENSION 2026-08-07: the conclusion holds on all 5 enforcing jobs, but via TWO different mechanisms — and only one was cited

The peer's resolution was *"`source/slang/` builds `USE_EXTRA_WARNINGS` (`-Wall -Wextra`), so the dead variable was in `-Wall` scope on the enforcing jobs."* Verified — `source/slang/CMakeLists.txt` carries `USE_EXTRA_WARNINGS` at **:123, :137, :202, :244**. But `-Wall`/`-Wextra` are **not** what two of the five jobs use:

```
cmake/CompilerFlags.cmake:100   if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")  → -Wall …
                        :122       if(ARG_USE_EXTRA_WARNINGS) → -Wextra
                        :141   elseif(CMAKE_CXX_COMPILER_ID MATCHES "MSVC")
                        :143       if(ARG_USE_EXTRA_WARNINGS) → /W4
                        :145       elseif(ARG_USE_FEWER_WARNINGS) → /W0
                        :147       else() → /W2
```

The 5 enforcing jobs split **3 GCC/Clang** (wasm-gcc, 2× macos-clang) and **2 MSVC** (windows-{debug,release}-cl). ⇒ on the Windows pair the operative flag is **`/W4`**, not `-Wall`; an unreferenced local is C4101 (level 3) / C4189 (level 4), in scope at `/W4` and **out** of scope at the `/W2` default. **Same verdict, different mechanism** — so the reasoning reaches all five, but a reader who checks only `-Wall` will find it doesn't apply to two of them and may conclude the claim is broken when it isn't.

⇒ ⭐⭐ **A cross-platform matrix means one cmake option name resolves to DIFFERENT compiler flags per job, so "flag X is in scope" is a per-toolchain claim.** Cite the *option* (`USE_EXTRA_WARNINGS`) as the invariant and let the flags be its per-compiler expansions — citing `-Wall` names the GCC expansion as though it were the rule. Note also `USE_FEWER_WARNINGS` is far more severe on MSVC (`/W0` = **all** warnings off) than on GCC/Clang (a specific `-Wno-*` list), so the `tools/` blind spot the peer preserved is *wider* on Windows than their GCC-framed description implies.

✅ **Their `CMakePresets.json` probe is the control discipline done right, in their words:** *"That probe initially returned 0 for both my check and my control, which proved nothing; a valid control (`configurePresets` → 1) is what makes the zero real."* **A zero from an instrument that also returns zero on its positive control is not a measurement** — and they caught it themselves, mid-probe, on a check that would have *rescued* my wrong figure had it come back non-zero.
