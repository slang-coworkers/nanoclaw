---
type: chain
title: "slang#13495: HLSL `class` should be a value type (HLSLClassDecl : StructDecl)"
description: "TERMINAL 2026-10-08: tangent-vector fixed it in their own PR #13497 (merged 2026-10-08T01:38Z, Fixes #13495, issue closed). Fixer never briefed; triager told to stand down. Sibling #13496 still open, own Main session."
---

# slang#13495: HLSL `class` parsed as a Slang reference-type `ClassDecl`

**Origin.** tangent-vector (MEMBER, language lead) opened this on 2026-10-07 19:59:35Z and self-assigned it; jkwak-work
added `Dev Opened`. Live read at dispatch: OPEN, 0 comments, body matches the payload. The issue body is already a
full design: add `HLSLClassDecl` deriving from `StructDecl`, route HLSL-dialect `class` through struct parsing, reuse
struct checking/lowering unchanged, keep Slang-dialect `class` as `ClassDecl`. It states that current DXC makes
members and inheritance public for both spellings, so no accessibility difference remains to implement. Acceptance
covers construction, independent copies, parameters/returns, and buffer elements, all matching structs.

**Sibling.** tangent-vector cross-referenced #13496 at 19:59:56Z ("Unify struct and class declaration parsing").
It proposes one shared core parser that picks `StructDecl` / `HLSLClassDecl` / `ClassDecl`. So #13496 builds on
#13495's AST node. #13496 has its own Main session (`sess-1791403198046-97ng1w`), and this session does not route it.

**Disposition (2026-10-07 ~20:05Z).** Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13495`. The
triager reproduces at HEAD, maps the parser/AST entry points, and checks for overlap with #13496 and closed #10305.
**Fixer HELD**: this is a design proposal from the language lead who self-assigned it. The design-RFC rule
applies (shared wiki: "design-RFC issues, hold the fixer"). A bot PR waits until tangent-vector asks for one.

**20:19Z triager ack (their finding, not yet checked by me).** They reproduced the issue example at `9f31ffcfd`:
E30019 on all 7 targets, and DXC returns 1. They are prototyping `HLSLClassDecl` locally on master, with the fixer still held. No `[Report]` yet.

**21:03Z triager `[Triage]` (their finding; I verified only the GitHub comment).** Enhancement/medium/P2, frontend
parser. Reproduced at master `93a54974c`; same failures on 2024.14 / 2025.1 / 2025.24.2, so not a regression. **No
aliasing observed**: the failures are compile errors and invalid output. The issue example gives E30019 (init list).
By-value param/return, methods and interface bases give E99997 on SPIR-V and E99999 on GLSL; the other targets
emit `RefObject` code that DXC rejects. Buffer elements give E39031 (#11058). A prototype of the issue's proposal
(~30 lines across ast-decl.h, parser.cpp and syntax.cpp, no checker or lowering changes) compiled every shape, DXC
accepted its output, and the regression subset passed 2408/2410 (both failures also fail on master). It was reverted.
Implementation notes: the nesting tables (`slang-parser.cpp:5508-5718`) need `HLSLClassDecl` entries; the #10305 test
`tests/diagnostics/hlsl-class-instantiation.slang` needs retargeting, because `-lang hlsl` follows the file path and
so doesn't apply to it; serialized AST tags shift. Memo `/workspace/inbox/a2a-1791406982519-rnlqq4/triage-13495.md`;
shaders, prototype.diff and matrices are in the triager's `/workspace/agent/scratch-13495*`.
- Posted comment **6046775420** (verified live: nv-slang-bot[bot], 21:01:32Z, 2477 chars). It ends with a go/no-go
  question to tangent-vector: bot draft PR, or they keep it / sequence it with #13496. `reproduced` label added.
- Triager side note, not posted: Slang-dialect `class` + `new` doesn't alias on `-target cpp` either. Possibly a
  separate ref-semantics bug. Left to the operator to decide whether to raise it.
- Re-chase **`rechase-13495-hlsl-class-e5eb`** (2026-10-08 21:00Z) watches for tangent-vector's reply. GO → triager
  releases the fixer with memo, tgz and prototype.diff. Own PR, or folded into #13496 → stand down.

**TERMINAL (re-chase run 2026-10-08 21:0xZ).** tangent-vector opened **#13497** "Parse HLSL classes as value types"
at 2026-10-07T20:19:26Z, 42 min *before* our go/no-go comment, and self-merged it at 2026-10-08T01:38:48Z (merge
`d074e7779e`). It is linked via `Fixes #13495`, which auto-closed the issue at 01:38:50Z. It touches the same 3 files as the triager's
prototype plus natvis, retargets `tests/diagnostics/hlsl-class-instantiation.slang`, and adds 7 tests. No human comment ever
landed on the issue. The stand-down went to `slang-triager` (msg 13, pinned to `sess-1791403522823-0tztrc`, thread
`gh-issue-shader-slang/slang-13495`): close our side, don't post. No reschedule. **Lesson:** the go/no-go question
was moot when posted. The check-for-the-assignee's-own-PR addendum is in the shared learning
`1781511232421-daily-report-check-for-a-linked-fix-pr-before-flag.md`.
Open loose end (operator's call): the triager's unposted side note that Slang-dialect `class` + `new` doesn't alias on `-target cpp`.
Triager confirmed closure at 2026-10-08 21:10Z (msg 26). It rechecked live that #13497 is merged and the issue is closed/completed, made no GitHub post, never briefed the fixer, and discarded the scratch files. The `[Resolution]` the re-chase sent the operator covers this, so Main sent no second report.
