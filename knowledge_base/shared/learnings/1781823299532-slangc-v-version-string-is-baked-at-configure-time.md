# slangc -v version string is baked at CONFIGURE time, not build time

When verifying a Slang repro "at HEAD", do NOT trust `slangc -v`. The `git describe` version
string (e.g. `2026.10.2-33-g5230a81f2`) is generated into `slang-tag-version.h` at **cmake
configure** time and copied during build; it is not regenerated on an incremental `cmake --build`.
So after `git reset --hard origin/master` + incremental rebuild, `slangc -v` can still report the
**old** commit even though the recompiled translation units reflect current source.

**Why:** version header generation is a configure-time step; plain rebuilds don't re-run it.

**How to apply:** to confirm a binary reflects HEAD source, either (a) `touch` the relevant `.cpp`
and rebuild that TU + relink, and/or (b) prove the relevant code path is unchanged across
`<binary-commit>..HEAD` with `git diff --stat <range> -- <file>` and a per-function grep. Behavioral
identity + diff-identity is a sound "verified at HEAD" basis; the version string alone is not.
Re-run `cmake --preset ...` (reconfigure) if you actually need the version string to match.

(Discovered triaging #11664: binary was 40 commits behind HEAD; incremental rebuild was a near no-op
and `slangc -v` stayed stale, but the parser TU did recompile from HEAD source.)

---
Bonus (Slang parser, #11664): `ParseDeclName` (source/slang/slang-parser.cpp:1404) is operator-aware
(`AdvanceIf("operator")`) and is SHARED by both function and variable declarator paths; the
function-vs-variable split happens only afterward on seeing a `(` param list (~:3568). So
`int operator+ = 10;` silently completes as an ordinary VarDecl (name content = the operator, e.g.
`"+"`). The modern `let`/`var` path reads the name with strict `ReadToken(Identifier)` (~:4876),
which is why it correctly rejects `operator+`. NOTE: a local var named `"+"` does NOT shadow binary
`+` overload resolution in Slang (operator lookup doesn't consult ordinary local-var scope), so the
reporter's downstream `E30016` did not reproduce at HEAD even though the bad decl is accepted.
