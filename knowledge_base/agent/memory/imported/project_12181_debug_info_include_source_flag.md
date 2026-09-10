---
name: project_12181_debug_info_include_source_flag
description: "#12181 new CLI arg -debug-info-include-source (embed shader source in SPIR-V at -g1 via core OpSource, no NonSemantic ext). Shipped in PR #12202, merged 2026-07-27; issue auto-closed."
metadata:
  node_type: memory
  type: project
  originSessionId: 8867d2d3-8352-4103-bb95-c3d97312a6b4
---

# #12181 — Add CLI arg `-debug-info-include-source`

**Terminal (positive).** Maintainer **jkwak-work** filed + self-assigned. Shipped
in **PR #12202, merged 2026-07-27 (merge commit `70462843c0`)**; issue #12181
auto-closed via `Fixes #12181`.

## What shipped
New orthogonal ABI flag `CompilerOptionName::DebugInfoIncludeSource = 157`
(append-only, `pr: non-breaking`), threaded through **both** the producer
(`slang-lower-to-ir.cpp` — carry source content at g1) and the consumer
(`slang-emit-spirv.cpp` — emit via core `OpSource`). Three behaviors, per jkwak's
spec:
- `-g0` (or no `-g`) **+ flag → error `E57007`** (conflicting request).
- `-g2`/`-g3` **+ flag → no-op** (full source already emitted via NonSemantic).
- `-g1` **+ flag → emit source via core SPIR-V `OpSource` File+Source operands**
  (+`OpSourceContinued` past the 65535-byte string-split), with **zero
  `SPV_KHR_non_semantic_info` dependency** for the source.

7 regression tests (g0-error / g1-core-OpSource / g2-no-op / continued-overflow /
utf8-boundary / #include / target-warning).

## Key design fact (durable)
Embedding source via NonSemantic `DebugSource` is an **implementation choice, not
a spec necessity**: SPIR-V core `OpSource` has optional File+Source operands, so
source *can* embed with no extension — Slang just hadn't wired that path. The
`-g1` case uses it so `-g1` stays extension-free.

## Arc lessons (durable — three CI red-herrings, each a distinct class)
- **aarch64 test-slang red = env token, not an arch bug.** aarch64 CI exports
  `SLANG_USE_SPV_SOURCE_LANGUAGE_UNKNOWN=1` → `OpSource Unknown` vs `Slang`
  elsewhere. Fix was test-only: `CHECK: OpSource {{Slang|Unknown}} 1`.
- **Windows-CL red = CRLF byte-shift.** A `.slang` fixture with no `eol`
  attribute checked out CRLF on Windows; the ~977 `\n`→`\r\n` conversions pushed
  a 2-byte codepoint past the 65535 `OpSourceContinued` split boundary. Fix:
  pin byte-exact fixtures to `eol=lf` in `.gitattributes`.
- **SlangPy linux-gcc red = GCC-PCH/FIDDLE bug #12227, NOT a poisoned runner
  cache.** The `slang-ir-insts.h.fiddle:13 'friend' used outside of class`
  failures were stale GCC precompiled-header expanding FIDDLE at namespace scope
  — fixed by jkwak's PR #12233 ("Exclude FIDDLE headers from GCC PCH"), not by
  the runner-cache clean that was (wrongly) escalated to the operator and later
  **corrected + withdrawn.** ⇒ **verify a CI run's PR+head association before
  crediting its conclusion**, and confirm a "dirty runner" hypothesis against a
  code-fix before escalating runner hygiene. See
  [[project_12227_stale_gcc_pch_fiddle_expansion]].

## Cross-links (SPIR-V debug-info cluster)
- [[project_12147_separate_debug_info_output_block]] — mirrors this flag's
  `-separate-debug-info` pattern.
- [[project_11682_g0_spirv_debug_info_scope_fork]] — `-g0` scope handling.
