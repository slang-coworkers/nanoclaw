---
name: project_12386_ptr_empty_struct_nonsimple_ice
description: "slang#12386 — comparing any pointer whose pointee transitively contains an empty struct ICEs at slang-ir-legalize-types.cpp:2197 (cuda+cpp only). NOT a dup of #7612. PR #12304 does not fix it and WIDENS it. Fixer working Approach A (diagnostic-instead-of-abort). RESUME = fixer [Fix Report] + PR number."
metadata: 
  node_type: memory
  type: project
  originSessionId: a26832cb-f085-4fc7-a9a3-2dab994488d5
---

# slang#12386 — Ptr-to-empty-struct comparison ICE

**slang#12386** "CUDA: Ptr to an empty struct compared with nullptr aborts slangc with
InternalError" — reporter `tdavidovicNV` (MEMBER), 2026-08-06. Verdict: **bug / medium / P2 / IR
type legalization + C-family (CUDA/CPU) emit. Not a regression** (assert predates v2026.14.1;
mechanism dates to #2746, 2023-03-28 — `regression` deliberately withheld). Labels `cuda` +
`reproduced`, Type=Bug. Issue verdict comment **5201487089**. Canonical thread
`gh-issue-shader-slang/slang-12386`.

## The bug — wider than the title
The real trigger is **comparing any pointer whose pointee type transitively contains an empty
struct** (triager cells, both byte-identical aborts): `p == q` with no `nullptr` (not
null-specific); `struct Wrap { Empty e; }` + `Ptr<Wrap> == nullptr`, pointee non-empty but
*contains* an empty field (not empty-pointee-specific). Non-triggers (boundary real): `Ptr<Empty>`
null-compared without `__getAddress` → 0; `__getAddress` + deref without comparison → 0.

**Scope is C-family emit, NOT CUDA-specific.** 2×7 matrix: cuda+cpp → 255 NONSIMPLE; spirv/metal →
E31160; hlsl/glsl/wgsl → E36107. The non-CUDA rejections are about `Ptr` as a *feature* (control:
non-empty pointee fails identically there), so the reporter's HLSL observation invites the wrong
inference.

## Mechanism (CORRECTED 2026-08-08, Main-verified @master `716ec597f`)
The failing operand is the pointer **VALUE, not its type.** `legalizeLocalVar` (`:2212`) legalizes
the **pointee** (`:2216`) → `none`; the `case simple:` fast path (`:2233`) is missed; control falls
to `default:` (`:2247`) → `declareVars`, whose `case LegalType::Flavor::none:` (**`:3377`**) returns
a bare `LegalVal()`. **The `var` legalizes to nothing, so fixing the pointer TYPE cannot help** — this
refuted (by instrumentation, not argument) the earlier `createLegalPtrType`/address-space producer
theory, now fully retracted (see derivation lesson below). The abort itself is
`slang-ir-legalize-types.cpp:2197` `SLANG_UNEXPECTED("non-simple operand(s)!")` — the `default:` arm
of `legalizeInst`, whose `:2196` already carries `// TODO: produce a user-visible diagnostic here`;
no comparison/arithmetic opcode has a case in that switch.

⚠️ **Three legalization contexts share that arm.** `legalizeInst` is a free static (`:2087`, `:2383`)
with no override; the other two contexts override `isSimpleType` to `return false` unconditionally
(`:4081`, `:4116`) so they reach the arm *more* readily. Blast radius of a diagnostic there =
**MEDIUM** (changes a failure mode, not policy). Diagnostic is expressible right there —
`context->m_sink->diagnose(...)` already at `:870`, `:903`, `:912`, `:2069`, `:2374`.

## ⛔ PR #12304 does NOT fix #12386 — it WIDENS it (load-bearing, survives the retraction)
| cell | master `9eb90c50a` | master + #12304 |
|---|---|---|
| reporter's repro / `p == q` / `Ptr<Wrap>` | 255 NONSIMPLE | 255 NONSIMPLE |
| non-empty pointee (neg ctl) | 0 | 0 |
| **`public struct Empty` + same compare** | **0 — compiles** | **255 NONSIMPLE** |

`PublicDecoration` is one of the seven decorations `isSimpleType` retains on every non-Metal target
(with `LayoutDecoration`, `ExternCpp`, `DllImport`, `DllExport`, `HLSLExport`, `BinaryInterfaceType`),
so a `public` empty struct survives legalization today and the comparison emits fine. #12304's entire
source contribution is a **one 4-line removal** of that decoration at the producer
(`slang-lower-to-ir.cpp`; delta via merge-base `dc9558d57`, ahead 1/behind 35) ⇒ the type legalizes
away ⇒ the comparison falls into the unhandled `default:`. **So producer-side removal converts a
silently-working program into an ICE** — empirical evidence (not argument) against "producer-side
removal is sufficient," feeding the `Office-Yong` layer fork without deciding it. Land-order note =
comment **5201498632**. The triager kept its PR note narrow (sequencing + mechanism, no fork claim)
so maintainers reach the conclusion from the receipt — endorsed.

**Method note (reusable):** a fresh worktree couldn't build (submodules unpopulated → configure dies
on `SPIRV-Headers`, wants DXC-from-source ~500 MB). Instead extract a PR's OWN delta via
`merge-base..head` (the two-way `master..pr` diff is polluted by the 35 commits master gained) and
bracket apply→build→measure→revert on the main clone — a tighter A/B, one variable. Positive control
that the patch was live in the binary: #12384's shape emits `struct Empty_0` on master (1), **0** with
the patch.

## Dedup — NOT a dup of #7612; the reporter's sibling is the proof
- **#7612 / #8125 family = RETENTION → layout skew** (empty struct kept as a real member while
  reflection says size 0 → offset skew → `CUDA_ERROR_ILLEGAL_ADDRESS`/SIGSEGV): silent ABI mismatch,
  output produced. See [[project_8125_empty_struct_cuda_infllight]].
- **#12386 = legalization COVERAGE → hard abort, no output, different site.** Shared ancestry,
  different bug.
- **#12384** — same reporter, filed 15 min *before* #12386, label `RTR`: "empty public struct field
  makes reflection and PTX disagree on entry-point parameter layout." This is the CUDA ABI mismatch
  #12386's body was minimized from ⇒ **#12384 is the #7612-family one; #12386 is the coverage
  sibling** — the split is self-evidencing.
- **#10069** ("ICE on zero-size array in nested struct") = same assert/file, but complementary target
  profile (spirv only vs cuda+cpp only) and different producing construct ⇒ same assert family,
  distinct bug. Side finding: #10069's "all targets" is STALE at HEAD (corrected as comment
  **5201579437**); companion #10070 asks for its regression test.
- **PR #11657** (closed) = the global `removeEmptyStructFields` pass, killed in CI by this exact assert
  (`layout-conditional-field.slang.4 (cpu)`). **Standing constraint: keep any fix consumer-side / in
  `IREmptyTypeLegalizationContext`, never a global removal pass.**

## Dispatch state — Approach A only
**Fixer working Approach A**: turn the abort at `:2197` into a diagnostic (the `// TODO` is there).
Small, collides with nothing, answers the issue's fallback ask, also improves #10069. **Approach B
(semantic ruling on what `Ptr<T>` means when `T` legalizes away, then opcode coverage) is RETRACTED,
not merely out of scope** — the corrected value-not-type mechanism showed it invented a maintainer
semantics dependency that did not exist and pointed an implementer at teaching a *consumer* to
tolerate a shape the *producer* emits (the exact "consumer-side patching" anti-pattern in CLAUDE.md's
methodology). If A cannot be done without touching legalization *policy*, that is a stop-and-report,
not a scope expansion.

Required test cells: (1) bare-`struct Empty` repro; (2) **the `public struct Empty` + pointer-compare
cell — the important one**: no guard anywhere, polarity flips (compiles now → ICE after #12304),
making the interaction visible to CI instead of to a human reading two issues. Canary (drift signal,
not a test to update): `tests/language-feature/dynamic-dispatch/layout-conditional-field.slang` (the
`.4` `-cpu` directive #11657 died on). Posture: draft PR, `Closes #12386`, `report_pr_created`,
`pr: non-breaking`, `./extras/formatting.sh` (formatters absent on triager's box → falls to fixer);
merge and ready-flip maintainer-gated, green CI ≠ authorization.

**Test-coverage gap:** all 29 `tests/` files using `nullptr` contain zero empty structs, while the
empty-struct regex matches 78–84 files ⇒ the two features were never combined; all 4 files with a
`public` empty struct have `Ptr<`/`__getAddress`/`nullptr` = 0 ⇒ **the regressing cell has zero
coverage on any target**, which is why #12304 can turn a working program into an ICE and stay green.
(My own enumeration was wrong by 26 files — the prefilter `Ptr<|__getAddress` is blind to the `T*`
spelling; the conclusion survived only because the triager tested from the full set —
[[feedback_an_enumeration_behind_a_prefilter_describes_the_prefilter]].)

## RESUME & follow-ups
- **RESUME = fixer [Fix Report] + PR number** → triager refreshes verdict `5201487089` in place (it is
  last commenter) and forwards [Triage Resolution].
- **Co-trigger:** if PR #12304 merges before this lands, the `public struct Empty` cell converts
  compiles→ICE in the wild — deliverable A becomes more urgent than it looks.
- **Pending Main action:** dispatch **#12384** as its own chain (its triage may turn on "is this
  already fixed by an open PR" — #12304 is arguably its fix; must NOT piggyback on #12386's thread,
  both compete for the same `isSimpleType` territory).

## Derivation lesson (the useful history from the retraction)
The wrong producer-side mechanism survived four exchanges of scrutiny because **the source comment at
`:990-991` was evidence about INTENT, not about THIS execution** — a plausible mechanism sitting
exactly where the code's own comment points reads as corroboration and is the hardest to keep
interrogating. The cheap check skipped for two days: **the assert prints its operand flavors** —
`arg[0].flavor = 0 = none` states "the value is nothing" outright. ⇒ **before asking WHO produced the
malformed shape, read WHICH thing is malformed** (a `none` *value* vs a `none` *type* sent the whole
analysis to the wrong layer). Also: `AddressSpace.Device` surfaces as `UserPointer` (a handled case)
while the IR default is `Generic` (unhandled) — never infer an IR address space from the surface enum
name. And #12304's review surface was misread twice a day apart (4 comments, not 2) —
[[feedback_a_negative_existence_claim_decays_fastest_under_concurrency]]. Guard `t-141e2a` prompt was
updated 2026-08-08 to carry the retraction so a future session isn't handed the dead root cause as
live instruction.
