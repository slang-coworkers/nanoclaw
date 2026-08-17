---
title: "slangc -v version string is baked at CONFIGURE time, not build time"
type: learning
topic: slang-compiler
source: learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md
---

# slangc -v version string is baked at CONFIGURE time, not build time

When verifying a Slang repro "at HEAD/ToT", do NOT trust `slangc -v` (or `SLANG_TAG_VERSION` /
`SLANG_VERSION_FULL`) as proof of what commit the binary's *code* is. The `git describe` version
string (e.g. `2026.10.2-33-g5230a81f2`) is generated into `slang-tag-version.h` by a CMake custom
command at **cmake configure** time and cached (in `CMakeCache.txt`); it is copied during build but
is **not** regenerated on an incremental `cmake --build`. So after `git reset --hard origin/master`
+ incremental rebuild, `slangc -v` can still report the **old** commit even though the recompiled
translation units reflect current source. (Observed repeatedly: binary reported `2026.10.2-33-g5230a81f2`
while HEAD was variously `55a994460` (~71–104 commits ahead), `6fac3e6d0`, or 40 commits ahead.)
Generated-header paths seen: `build/<cfg>/include/slang-tag-version.h` and
`build/source/slang/slang-version-header/slang-tag-version.h`.

**Worse failure mode:** an *incremental* `cmake --build --target slangc` can do essentially nothing
(only copy the version header) and leave you running a genuinely stale binary from a prior session's
commit — the build "succeeds" (exit 0) but the object files were never recompiled. This silently
invalidates a "verified at HEAD" claim.

**Why:** version-header generation is a configure-time step; plain rebuilds don't re-run it. (One
observation suggested even a `cmake --preset` reconfigure may not re-derive it when CMakeCache holds
the value — so the deterministic refresh is to delete the generated `slang-tag-version.h` before
building, then reconfigure.)

**How to apply — prove the binary reflects HEAD by behavior/source, not by the version string:**
- `touch` the implicated `.cpp` (first confirm `git status --porcelain <files>` is empty = exactly
  HEAD content), rebuild the target, and confirm the build log shows those `*.cpp.o` recompiling +
  a relink — watch ninja actually build objects (`[N/M] Building CXX ...`), not just "copy version header".
- and/or prove the relevant code path is unchanged across `<baked-sha>..HEAD` with
  `git diff --stat <range> -- <file>` + a per-function grep; `git merge-base --is-ancestor <baked-sha> HEAD`
  and `git log <baked-sha>..HEAD -- source/` tell you whether the baked SHA is behind and whether the
  delta touches the compiler.
- exercise a ToT-only flag the old binary wouldn't accept (added by a recent PR) — exit 0 proves the
  new code is in.
- behavioral identity + diff-identity is a sound "verified at HEAD" basis; the version string alone
  is not.

**To refresh the string** (only if you actually need it correct): re-run `cmake --preset ...`
(reconfigure) or delete the generated `slang-tag-version.h` before building. For read-only repro work
the cosmetic staleness is harmless once the binary is confirmed ToT by other means.

(Discovered triaging #11664.)

---
**Bonus gotcha (build collisions, same cluster):** at container start, `build/Debug` may be actively
rebuilt by a provisioning/host process that is INVISIBLE to the container's `ps` (different PID
namespace). Symptom: `libslang-compiler.so` flips to "invalid ELF header" / size oscillates
(0 → 270MB) mid-link. Wait for mtime quiescence (stable across ~30s) before building yourself, or
you'll collide. Repo: shader-slang/slang at /workspace/agent/slang.

---
**Bonus (Slang parser, #11664):** `ParseDeclName` (source/slang/slang-parser.cpp:1404) is
operator-aware (`AdvanceIf("operator")`) and is SHARED by both function and variable declarator
paths; the function-vs-variable split happens only afterward on seeing a `(` param list (~:3568). So
`int operator+ = 10;` silently completes as an ordinary VarDecl (name content = the operator, e.g.
`"+"`). The modern `let`/`var` path reads the name with strict `ReadToken(Identifier)` (~:4876),
which is why it correctly rejects `operator+`. NOTE: a local var named `"+"` does NOT shadow binary
`+` overload resolution in Slang (operator lookup doesn't consult ordinary local-var scope), so the
reporter's downstream `E30016` did not reproduce at HEAD even though the bad decl is accepted.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781823299532-slangc-v-version-string-is-baked-at-configure-time.md`_
