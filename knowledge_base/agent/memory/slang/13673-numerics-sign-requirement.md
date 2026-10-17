---
type: chain
title: "slang#13673: add `sign` to `slang.numerics` (ISignedNumeric.IntegerSign)"
description: "tangent-vector (language lead) feature proposal, self-assigned (jhelferty-nv assigned 10-15 18:20Z). New ISignedNumeric requirement `IntegerSign sign()` + associated type; IScalarSignedNumeric pins it to int. Open gap: no integer-matrix conformances for matrix<int,R,C>. TRIAGED 10-16 07:41Z (cmt 6210602589, Feature, `reproduced`): feature/low/P2, gap confirmed at e49310561e. PARKED on tangent-vector; fixer HELD (design-RFC). Triager re-check t-6d276c 10-23 18:00Z."
---

# slang#13673: `sign` support in `slang.numerics`

**Origin.** tangent-vector (MEMBER, language lead) opened it 2026-10-15 18:20:19Z; jhelferty-nv assigned it
to tangent-vector at 18:20:29Z. Webhook reached Main ~12.5 h late (10-16 06:58Z). Live read at dispatch:
OPEN, 0 comments, no labels, body = payload (4080 chars). Human-filed, not bot-filed. Only session on
`gh-issue-shader-slang/slang-13673` was this Main webhook session; no task, no PR, no transcript hit.

**Ask.** Add `associatedtype IntegerSign : ISignedIntegerType` and `IntegerSign sign()` to `ISignedNumeric`;
`IScalarSignedNumeric` adds `__constraint IntegerSign == int` (floats too, matching core `sign`). Free-function
wrapper; builtin conformances route to core `sign` via the `abs` adapter pattern in
`source/standard-modules/numerics/__builtin.slang`. Shaped results are `vector<int,N>` / `matrix<int,R,C>`.
**Author-flagged gap:** integer-matrix conformances do not exist yet, so `matrix<int,R,C>` cannot satisfy
`ISignedIntegerType`; cooperative vectors also need handling.

**Related.** #13676 (SPIR-V `float(sign(x))` round-trip) is unrelated per that chain's record. Sibling
#13674 (tangent-vector, `this` visibility, filed 18:25Z) has its own Main session and is not routed here.

**Disposition (10-16).** Dispatched to `slang-triager` on the canonical thread: read-only triage, verify the
matrix-conformance gap and the cooperative-vector shape at HEAD, post the 5-bullet. **Fixer HELD**: design
proposal from the self-assigned language lead (#13495/#13496 precedent; #13495 they fixed themselves).

07:04Z triager ack: read-only triage started at HEAD e49310561e (vector / matrix / CoopVec conformance map). Awaiting report.

**07:43Z triage report (verified by Main: comment 6210602589 by nv-slang-bot 07:41:27Z, Type=Feature, label `reproduced`).**
feature-request / low / P2, not a duplicate. Gap confirmed at HEAD e49310561e (generic `sign(v)` → E39999). Triager's findings:
scalars, `vector<int,N>`, CoopVec already have an `ISignedIntegerType` result; **`matrix<int,R,C,L>` conforms only to
`INumericExtrema`** (`builtin-conformances.slang:397-407`, documented limit `a3-02-numerics.md:525`); **CoopVec has no core
`sign`/`abs`**, so its witness must loop per element like `absoluteValue`. Recommended A (only if a PR is requested): PR1 int-matrix
`IIntegerType`/`ISignedIntegerType` conformances, PR2 `IntegerSign` + `sign()` + adapter + wrapper. B (relaxed bound) memo-only.
Open for the author: prerequisite ordering, CoopVec `IntegerSign` shape, `sign(NaN)` docs. Memo: `/workspace/inbox/a2a-1792136587847-fkqogc/triage-13673.md`.
Side note `sign`/`abs(intptr_t)` E99997 on SPIR-V is already tracked by open #13200 (signed `IntPtr` SPIR-V emit), so nothing to file.

**Resumes on:** triager report, a tangent-vector comment or go-ahead (webhook), or a linked PR.
