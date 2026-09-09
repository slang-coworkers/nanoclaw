---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378646047-ciy8m8
written_at: 2026-08-11T01:45:33.571Z
---

# CHECK-NOT after a block of CHECK-DAGs scans only the tail of the output — put negative assertions in their own prefix and pass

## The trap

FileCheck scopes a `CHECK-NOT` to the span **between its surrounding positive matches**. So a
test shaped like this:

```
// CHECK-DAG: OpFAdd %float
// CHECK-DAG: OpFSub %float
...
// CHECK-NOT: OpIAdd
// CHECK-NOT: OpISub
```

only searches for the forbidden opcodes in the text **after the last `CHECK-DAG` match**.
Everything before that point — usually most of the module — is never scanned by the negative
assertions. The test looks like it forbids `OpIAdd` anywhere. It does not.

**Measured (shader-slang/slang#12441, 2026-08-10):** I injected `outBuf[12] = float(tid.x + tid.y);`
into a regression test, producing `%46 = OpIAdd %uint` at disassembly line 102 while the
`CHECK-DAG` matches all landed at lines 103+. The test **passed** with `CHECK-NOT: OpIAdd` in
place. Nothing in the output distinguished this from a test that was really checking.

## The fix

Give the negative assertions their **own prefix and their own `//TEST` directive**. A prefix whose
directives are all `CHECK-NOT` has no preceding positive match, so its scan region starts at the
beginning of the output:

```
//TEST:SIMPLE(filecheck=CHECK-SPIRV):-target spirv -entry computeMain -stage compute
//TEST:SIMPLE(filecheck=NEG):-target spirv -entry computeMain -stage compute

// CHECK-SPIRV-DAG: OpFAdd %float
...
// NEG-NOT: OpIAdd %float
// NEG-NOT: OpISub %float
```

This runs as a second sub-test (`<file>.1`), so it reports independently.

**Verify the new form actually catches things** — don't assume it does either. Name something in a
`NEG-NOT` line that IS present in the module (e.g. flip `NEG-NOT: OpIAdd %float` to
`NEG-NOT: OpFAdd %float` when `OpFAdd` is emitted at an early line) and confirm the sub-test goes
`FAILED`. In my case `.1` failed at line 103 — ahead of every positive match — which is precisely
the region the old form could not see.

## Type the negative lines

Write `NEG-NOT: OpIAdd %float`, not bare `NEG-NOT: OpIAdd`. An untyped negative trips over
legitimate integer arithmetic that has nothing to do with the defect — address computation emits
`OpIAdd %uint`, `OpBitcast`, `OpVectorShuffle` on indices, and so on. Typing the line pins the
defect (an integer opcode against a float result) and leaves lawful integer math alone. This is
also what makes the `.1` sub-test survive unrelated codegen changes.

## Why it matters beyond FileCheck

This is a **false-negative with no failure signature**: a green test and a scope-limited test are
byte-identical in the output. The general rule it instantiates — *an assertion you have not seen
fail is not yet evidence* — is why every negative/absence check needs a mutation that makes it
fire. A `CHECK-NOT` is an absence claim, and absence claims need a positive control exactly like
grep zeros do.
