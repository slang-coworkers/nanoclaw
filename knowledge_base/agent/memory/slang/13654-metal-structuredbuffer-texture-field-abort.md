---
type: chain
title: slang#13654 — Metal StructuredBuffer<S> with a Texture2D field aborts slangc
description: "albertrodriguezclo, human-filed Metal bug: texture method on a StructuredBuffer element field aborts slangc (intrinsic-expand assert). Triaged 10-15 15:03Z (cmt 6195242328) P2: Metal wrongly skips E38204 and legalizeResourceTypes leaves SB<tuple> simple; DRAFT PR #13681 @500a07ba31 (legalizer reports E38204; pr: non-breaking), jkwak-work assigned."
---

# slang#13654

**2026-10-15 14:3xZ, webhook `issue_opened`.** Read live before dispatching: OPEN, 0 comments, no
labels, no assignee, human-filed by albertrodriguezclo (same reporter as the #13631–#13646 batch),
`updated_at` = `created_at` (14:29:56Z). The only session on `gh-issue-shader-slang/slang-13654` was
this Main webhook session. No memory or `conversations/` hit; `gh search` found no duplicate.

Adjacent, not a duplicate: open **#12529** (bot-filed, Diagnostics/reproduced, jvepsalainen-nv) — a
statement-form `__intrinsic_asm` `$N` indexes past its args and asserts at the same
`argIndex < m_argCount` release assert. Here the assert is the symptom; the reporter's IR shows
`_Texture.SampleLevel` called with 3 args (the texture operand gone), so the producer is likely
Metal resource-in-struct legalization of the structured-buffer element. Unverified by me.

Assert site at master 6597ec9202: `slang-intrinsic-expand.cpp:406` (also :891, :915).

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13654`.

**Resumes on:** the triager's [Triage] report, or a human comment.

**14:36Z, triager progress (msg 8):** reproduced on ToT 6597ec9. HLSL/SPIR-V/GLSL/WGSL reject the
source with E38204 ("resource type in StructuredBuffer"); Metal skips the check and aborts. Still
tracing which pass drops the operand. Not a completion report.

Orchestrator receipt for the "Metal skips" half: `StructuredBufferValidationContext::validate`
(`slang-ir-validate.cpp:931`, called from `slang-emit.cpp:2035`) returns early when
`areResourceTypesBindlessOnTarget` (`slang-type-layout.cpp:3549-3551`), and that is true for
CPU || CUDA || Metal. Metal is exempted as "bindless", but the later lowering does not actually
handle a texture field read from an element. That is the triager's open question: is the fix a
diagnostic (narrow the exemption) or real lowering. Passed to the triager on the thread.

**14:39Z, triager progress (msg 10):** CPU and CUDA do **not** abort on this repro. CPU emits the
struct with a `Texture2D` field; CUDA emits `tex2DLod(materials.Load(i).t, …)`. The triager says
Metal is the only target that is both exempt from E38204 and still runs `legalizeResourceTypes`
(resource-splitting). (a) and (b) will be answered in the [Triage].

Orchestrator receipt, verified at 6597ec9: `legalizeResourceTypes` (`slang-emit.cpp:2049`) runs
under `if (options.shouldLegalizeExistentialAndResourceTypes)` (:1976). That flag defaults to true
(:401) and is set false only for SourceLanguage C/CPP/CUDA (:3067-3070) and one more path (:3813).
So the triager's "Metal is the odd one out" claim holds. The mismatch is that Metal is classified
bindless for the validator but non-bindless for legalization. No reply sent (nothing to add).

**15:02Z, [Triage] (msg 12, file `triage-13654.md`).** Bug / medium / Metal emit + IR type
legalization / P2, reproduced at 6597ec9, not a regression, no duplicate. Two gaps combine:
- (a) The E38204 skip covers Metal. Metal was added to `areResourceTypesBindlessOnTarget` for
  DescriptorHandle layout (#6028). The validator's call site (`slang-emit.cpp:2035`) sits inside the
  `shouldLegalize…` block, which CPU/CUDA never enter, so the skip's only live effect is on Metal.
  The triager infers Metal was swept in by accident: the #8222 discussion covers CPU/CUDA only, and
  every E38204 test is SPIR-V-only.
- (b) Inside `legalizeResourceTypes`: `Material` becomes a tuple. The SB-type `default:` arm
  (`slang-legalize-types.cpp:1416-1417`) returns the buffer as `simple`, which is the root mismatch.
  `kIROp_StructuredBufferLoad` (`slang-ir-legalize-types.cpp:2193-2198`) assumes an empty element and
  returns none (it asserts only in debug). `LegalCallBuilder::addArg` drops the none arg. That leaves 3 args
  against `$c$0.sample(...)`, so the intrinsic-expand assert fires.
- #12529 is ruled out (it only shares the assert site). The closest mechanism is #13106 (closed).
- Approaches: A (Metal gets E38204; narrow the validator skip, leave the predicate alone), B (real
  argument-buffer lowering; a feature, parked for a Metal maintainer), C (legalizer fails loudly at
  1416 and 2193). **Recommended A + C**, handed to slang-fixer.

Receipts verified by me: :1416-1417 and :2193-2198 match the quote. The validator at :2035 and
`legalizeResourceTypes` at :2049 are both under the `if` at :1976. Triage comment
issuecomment-6195242328 (nv-slang-bot, 15:03:24Z). Label `reproduced` and Type=Bug are set. There is
one slang-fixer session on the canonical thread (`sess-1792076538832-j7oqw9`, created 15:02), no
duplicate.

**Unfiled side finding (operator call):** `uniform Material* p` asserts at
`slang-ir-legalize-types.cpp:3504` on both Metal and SPIR-V. This is a separate bug.

**15:05Z, fixer progress (msg 24):** building `fix/issue-13654` in a fresh worktree, plan A + C, ETA ~25 min. Not a report.

**15:53Z, fixer progress (msg 26):** reproduced on master (debug ICE at `slang-ir-legalize-types.cpp:2197`).
Fix built; 11 new subtests pass; full `slang-test` A/B against a master snapshot is running. **It deviates
from the triage plan:** dropping the skip would newly reject `StructuredBuffer<Texture2D>` on Metal, which
the fixer says compiles today to the same MSL as `Texture2D.Handle` (fixer's finding, unverified). So the
validator now rejects only *resources inside aggregate elements* on bindless targets. C is applied at
`slang-legalize-types.cpp:1416` only, not at 2193. A draft PR follows the suite and CODE_REVIEW.
I asked one question on the thread (see the reply): CPU/CUDA are "bindless" and compile aggregates
correctly; they only escape the new rule because they never reach the validator.

**18:09Z, fixer update (msg 28):** full-suite A/B (local, not CI) is clean (no new failures vs master;
225 synthesized Metal compile-only tests pass). `/code-review medium` then found two regressions, which the
fixer confirmed master vs HEAD (its findings, unverified by me):
- A's validator walk newly rejects `StructuredBuffer<Ptr<Texture2D>>` and struct-with-`Ptr<Texture2D>` on
  Metal, both of which compile on master.
- C at 1416 newly ICEs `SB<ConstantBuffer<M{Texture2D}>>` (never dereferenced, Metal) and
  `DescriptorHandle<StructuredBuffer<M>>` (HLSL/SPIR-V, emits invalid HLSL on master).
**Re-plan:** the legalizer at `slang-legalize-types.cpp:1416` reports E38204 and stops; the validator
reverts to its master form; 2193 becomes `SLANG_RELEASE_ASSERT` with a reachability argument. This is the
producer-side version of my msg-27 point 1. A/B again before CODE_REVIEW. My reply (msg 29) asked for
three things: a use-site source location, de-duplication, and a newly-rejected-shapes inventory with a
label call.

**19:06Z, fixer prototype (msg 30), its findings, unverified by me.** `legalizeResourceTypes` legalizes
every SB type first; the SB arm at `slang-legalize-types.cpp:1416` reports E38204 and the pass returns
`SLANG_FAIL` (no E99997; checked with a COM `getEntryPointCode` probe). The validator is back to its master form.
- Location: the repro points at `materials` 2:28, the same span as SPIR-V. An entry-point SB param points at
  the entry name; an SB in a ParameterBlock struct points at `struct PB`.
- One E38204 per buffer: 3 use variants plus a 2nd bad buffer give 2 diagnostics (Metal + SPIR-V).
- Newly rejected (compiled on master): Metal `SB<ConstantBuffer<M{Texture2D}>>` never dereferenced;
  HLSL/SPIR-V `DescriptorHandle<SB<M{Texture2D}>>` (master HLSL invalid; the SPIR-V validity question is
  in msg 31). Still compiles on Metal: `SB<Texture2D|Texture2D[2]|SamplerState>`, DescriptorHandle fields,
  `Ptr<Texture2D>`. Shapes that used to ICE and now get E38204: `SB<SB<M>>`, `static` SB, structs with CB/SB fields.
- New test `tests/diagnostics/structuredbuffer-resource-metal-wrapped.slang` passes 3/3 HEAD, 0/3 master.
  The full suite plus synthesized A/B are running; the fixer's call is `pr: non-breaking`.

**19:09Z, fixer (msg 32), label gap closed (fixer's evidence, unverified by me):** master SPIR-V for
`DescriptorHandle<SB<M{Texture2D}>>` fails validation (`VUID-StandaloneSpirv-None-04667`, opaque type in
`OpTypeStruct`, then E99999). Field-read and sample uses ICE at `slang-ir-legalize-types.cpp(2197)`. So no use
of that shape gave valid SPIR-V on master, and **`pr: non-breaking` holds**. HLSL/GLSL "compiled" to invalid
output (dxc/glslang not run). Full `slang-test` A/B: no fix-only failures (fix 14 ⊂ master 23; the 9
master-only failures are the new tests). Synthesized compile-only A/B still running. Next: commit re-split,
CODE_REVIEW, draft PR.

**20:02Z, DRAFT PR #13681 @dbf98aab69 (msg 34 = explain-diff HTML).** Verified live 20:05Z: OPEN, draft,
head `fix/issue-13654`, `Fixes #13654`, label `pr: non-breaking`, jkwak-work assigned. 7 files
(`slang-legalize-types.cpp` +59 with the new `diagnoseUnlegalizableStructuredBuffer`; `slang-ir-legalize-types.cpp`
+20/-2 with the `SLANG_RELEASE_ASSERT` at the SB-load case; `slang-emit.cpp` +1/-1; `.h` +1/-1; 3 new tests). CI:
57 skipped / 6 success (draft-gated). The `pr-mappings` row points to the fixer session `sess-1792076538832-j7oqw9`
on the canonical thread. The body uses the short Summary/Root-cause/Tests/Risk form (same as #13607/#13564). The full Process
report lives in the explain-diff comment and covers all my asks: legalizer-decides rationale, rejected
alternatives, the SB-load reachability argument, a newly-rejected table with the VUID-04667 evidence, and the
`pr: non-breaking` call marked maintainer-overrulable. I did not re-run the tests.

**20:11Z, fixer 5-bullet (msg 62):** peer review requested, and the [Fix Report] waits on that verdict. That explains why
no report reached the triager yet; the earlier "not confirmed" check was a timing artefact. Verified 20:12Z:
issue status comment issuecomment-6201285206 (nv-slang-bot, 20:10:16Z); explain comment
issuecomment-6201118996. CI run 38797844319 on dbf98aab69 is `waiting` (approval gate). One `slang-reviewer`-group
session (`sess-1792095004789-9877zg`, ag-…a9tac8) is running on the canonical thread, no duplicate. The fixer
reports CODE_REVIEW and OUTPUT_REVIEW approved (its claim).

**22:40Z, review round 1 addressed (msgs 70 + 74).** Internal R1 was REQUEST_CHANGES (small). Head is now
**500a07ba31**: 4 incremental commits on dbf98aa, no force-push. Verified 22:4xZ: the commit list matches, CI run
38817384046 on 500a07b is `waiting` (approval gate), and the explain comment 6201118996 was rewritten at 22:38:40Z. The
issue status comment 6201285206 ("held pending peer review") is still accurate. GitHub shows no reviews yet;
the internal review isn't posted there. Changes, as the fixer describes them: phi params no longer get their own E38204
(Metal and SPIR-V locations now identical); only the resource-legalization context reports split SB
elements, and anything else hits `SLANG_UNEXPECTED`, so the SB-load release assert holds by construction. **New inventory row:**
`static StructuredBuffer<S{Texture2D}>` now gets E38204 on SPIR-V/HLSL/GLSL/WGSL. On master it gave E99997 in debug
and an empty kernel in release, so it never produced usable output and `pr: non-breaking` still holds. New tests cover the DescriptorHandle
use-location fallback and FN+phi. Both A/B runs are clean (the fixer's claim). Round 2 is with slang-reviewer, declared the last round.

**Resumes on:** slang-reviewer's verdict → the fixer's [Fix Report] → the triager's [Triage Resolution], a maintainer
review on #13681, or a human comment. After that it parks on maintainer review plus operator ready-for-review (CI is draft-gated).
