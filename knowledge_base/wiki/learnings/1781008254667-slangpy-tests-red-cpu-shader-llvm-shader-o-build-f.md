---
title: "SlangPy Tests red = cpu-shader-llvm shader.o build failure (master infra, not your PR)"
type: learning
topic: slang-compiler
source: learnings/1781008254667-slangpy-tests-red-cpu-shader-llvm-shader-o-build-f.md
---

# SlangPy Tests red = cpu-shader-llvm shader.o build failure (master infra, not your PR)

If a slang PR's `SlangPy Tests` check is red, **read the slangpy run log before assuming your PR broke something** — a current, master-wide failure makes every up-to-date PR's SlangPy check red without any PR being at fault.

**Symptom (observed 2026-06-09 on slang PR #11424):** slangpy `ci-latest-slang` `build-pr` jobs fail (both Linux + Windows) building the slang `cpu-shader-llvm` example:
- Windows: `LINK : fatal error LNK1181: cannot open input file 'examples\cpu-shader-llvm\shader.o'`
- Linux: `/usr/bin/ld: cannot find examples/cpu-shader-llvm/shader.o: No such file or directory`
The `[.../1519] Generating shader.o` ninja step runs and is NOT marked `FAILED:`, yet the object is absent at link time.

**Root cause / status:** This is the `cpu-shader-llvm` example's `shader.o` generation (`slangc -target shader-object-code -emit-cpu-via-llvm ... -o shader.o`, gated on `slang-llvm`). Commit `bbc4b0278` "Fix Ninja race between cpu-shader-llvm-link and shader.o generation (#11456)" (landed 2026-06-03 15:46 UTC) targets exactly this and added `set_source_files_properties(... GENERATED TRUE)` to force a file-level ninja edge. **That fix is insufficient: with it present, the build still failed 2/2 (original run + a `gh run rerun --failed`), same cause, both platforms.** So it's NOT a winnable race — reliably broken in slangpy's high-parallelism subproject build. (Could be the producer command silently not writing the file, i.e. a deeper `-emit-cpu-via-llvm`/slang-llvm issue, rather than pure ordering.)

**Why it looks PR-specific but isn't:** other slang PRs were green the same day because their slang head was on **older master that didn't build this example at all** (zero `cpu-shader-llvm` lines in their logs). As PRs rebase onto current master, they will start building the example and hitting this. So expect a wave of `SlangPy Tests` reds unrelated to PR content.

**How to apply:**
1. Don't treat a red `SlangPy Tests` as your regression until you've confirmed the failing step. If it's `cpu-shader-llvm`/`shader.o`, it's this infra bug — your PR is likely fine.
2. Don't fold an example-CMake/build fix into an unrelated PR (wrong scope; #11456 owns this area). Escalate a separate master-side fix (strengthen #11456 / fix the `shader.o` producer).
3. Reruns won't help (2/2 reliable). Don't burn `gh run rerun` more than once to confirm.
4. A PR blocked only by this is "blocked by infra," not unmergeable on its own merits — rebase + its own slang CI green + approved still stands.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781008254667-slangpy-tests-red-cpu-shader-llvm-shader-o-build-f.md`_
