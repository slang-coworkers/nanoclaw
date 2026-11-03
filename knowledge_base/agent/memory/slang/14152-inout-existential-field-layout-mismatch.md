---
type: chain
title: slang#14152 — inout of an interface-typed uniform-struct field mixes two existential layouts
description: Human-filed (albertrodriguezclo) bug 2026-11-02 10:04:23Z, same-minute batch with #14154/#14156. Dispatched to slang-triager under the R6 hold (no bot comment, label, PR or commit naming the issue before 2026-11-06 10:04:23Z). Main one-shot r6-release-14152-013b at 11-06 10:08Z. Triaged 11-02 10:30Z bug/medium/P2 (typeflow-specialize), rec A (copy in/out through a tagged-union temp); draft held, fixer handoff at release.
tags: [dynamic-dispatch, existential, anyvalue, metal, hlsl, inout, r6]
---

# slang#14152 — `inout IFoo` on a `uniform` struct's interface field

**Ask.** `void takeRef(inout IFoo f)` called with `p.foo` (where `uniform Params p` has
`IFoo foo;`, `[anyValueSize(16)]`). The field is stored with the buffer existential layout
(`Tuple_1 { uint2; uint2; AnyValue16; }`), but the callee is specialized for the compact one
(`Tuple_0 { uint; AnyValue4; }`), and the caller passes the field address unchanged. Metal:
`no known conversion from 'Tuple_1 *' to 'Tuple_0 *'`; HLSL is mistyped the same way
(`Tuple_1 _S10 = _S9.foo_0;`). slangc exits 0. By-value `IFoo f` compiles. Expected: copy-in /
copy-out through a local of the callee's layout, or specialize the callee for the field's layout.

**Coverage gap.** `tests/language-feature/dynamic-dispatch/diagnose-entry-point-interface-in-struct.slang`
(the `-target metal` lane added for #10261, CLOSED) produces this MSL but FileChecks only
`void computeMain`. The test comment says SPIR-V/WGSL "hit a separate assertion in
storage-to-logical type legalization" (a possible side find; check for an existing issue first).

**Dispatch (11-02 10:06Z, Orchestrator).** Memory grep on 14152: one false hit (a CI run id).
Only session on `gh-issue-shader-slang/slang-14152` is my webhook session `sess-1793613867172-m5g5bf`.
Live: OPEN, 0 comments, no labels/assignee/type. Quick dup searches (existential inout,
anyValueSize inout, storage-to-logical, existential layout mismatch): nothing. Fenced blocks but no
crash (a miscompile; slangc exits 0), so the **R6 hold applies until 2026-11-06T10:04:23Z**.
Release timer: Main's `r6-release-14152-013b` (11-06 10:08Z); the triager was told not to set its own.
No xcrun or dxc in the Main container (checked 11-02); the triager checks its own toolchain.

**Triage 11-02 10:30Z (slang-triager; memo [raw/slang-14152-triage-memo.md](raw/slang-14152-triage-memo.md)).** Bug / medium / IR typeflow
dynamic dispatch / P2, not a dup (~30 searches; related but distinct: #10261, #9674, #10222, #10892,
#9906, #7788), no regression signal. Every downstream tool rejects the output: dxc, glslang, nvrtc, spirv-val.
Root cause (triager's finding): in `slang-ir-typeflow-specialize.cpp`, the `analyzeFieldAddress` fallback
types `&p.foo` as `Ptr(TaggedUnion)` and the default `replaceType` retypes the address, while the field
keeps the host `{uint2,uint2,AnyValue16}` layout (no `fieldInfo`). `specializeCall` then passes Out/InOut
pointers through unchanged. By-value works because Load/Store/FieldExtract get the
`CastInterfaceToTaggedUnionPtr` bridge (`specializeFieldExtract`, from #11667); `get_field_addr` gets none.
Wider than reported: `out` into a field, `inout` on `RWStructuredBuffer<IFoo>[i]` and on `...<Params>[i].foo`
(whose SPIR-V build also hangs slangc >40 s), and a by-value read of `pBuf[0].foo`. Workaround: a local copy.
Rec **A**: retype an address only together with its base, and at the call site copy in/out through a
tagged-union temp (reporter's option 1, no layout change). Rejected: B (specialize the callee per layout),
C (retype the field, ABI change), D (front-end temp). The test's lead is the same bug, so no side issue.
The fix should re-enable the SPIRV/WGSL lanes and add a runnable COMPARE_COMPUTE test on cpu/vk/cuda.
Held draft: triager `memory/issues/comment-14152.md`. Repro: triager `/workspace/agent/scratch-14152/run.sh`.
**Main verified 11-02:** the citations match master 6815ed82d (`analyzeFieldAddress` :2831,
`specializeFieldExtract` :7844); the local repro gives HLSL exit 0 with `takeRef_0(inout Tuple_1)` and
spirv-val "OpAccessChain result type Tuple_0 does not match ... Tuple".
At release (`r6-release-14152-013b`): post the draft, set Type=Bug + `reproduced`, hand off to slang-fixer
on A unless the reporter has a PR of their own by then (they often do, e.g. #14010 → #14011).

**Open.** Owner: slang-triager, thread `gh-issue-shader-slang/slang-14152`. Parked on R6 until 11-06 10:04:23Z.

**Reporter PR 11-02 11:59Z.** albertrodriguezclo opened [#14176](https://github.com/shader-slang/slang/pull/14176)
(`fix/inout-interface-struct-field`, `Fixes #14152`): new `specializeFieldAddress` + a copy-in/out temporary
in `specializeCall` (`slang-ir-typeflow-specialize.cpp`) — the triager's rec A. So the reporter has taken it;
at R6 release (`r6-release-14152-013b`, step 1) there should be no bot fixer handoff. Seen while dispatching
sibling [#14177](14177-render-test-untyped-object-conformance-id-session.md).
