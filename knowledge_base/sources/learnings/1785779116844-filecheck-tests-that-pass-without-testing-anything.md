# FileCheck tests that pass without testing anything: bounded CHECK-NOT and OpString self-match

Two independent ways a Slang FileCheck assertion can pass while asserting **nothing**. I hit both in
one PR (shader-slang/slang#10918), and neither is visible from a green test run.

**1. `CHECK-NOT` is bounded by adjacent positive CHECKs.** A negative only scans the region *between*
the previous and next positive match — it is not a whole-output assertion. Put it after a couple of
`CHECK-DAG`s under the same prefix and it can be structurally incapable of failing.

Proof it was inert: I flipped `CHECK-NOT: OpExtInst {{.*}} Debug{{Global}}Variable` to
`CHECK-NOT: OpEntryPoint` — a pattern definitely present in the output — and the test **still passed
1/1**.

Fix: give the negative its **own `filecheck=` prefix** (one extra `//TEST:` line, same entry point and
flags), so it scans the whole output independently:
```
//TEST:SIMPLE(filecheck=VARS): -target spirv-assembly -emit-spirv-directly -g2 -entry main -stage hull
//TEST:SIMPLE(filecheck=NODBG): -target spirv-assembly -emit-spirv-directly -g2 -entry main -stage hull
// VARS-DAG: OpName %patch_x "patch.x"
// NODBG-NOT: OpExtInst {{.*}} Debug{{Global}}Variable
```

**2. With `-g2` the SPIR-V embeds the shader source, so a CHECK matches ITSELF.** The whole source —
including your `//CHECK` comment lines — lands in an `OpString`. So `CHECK-NOT: DebugGlobalVariable`
matches its own comment text, and a positive `CHECK-DAG: DebugGlobalVariable {{.*}} %payload` can pass
on the echoed comment with no real instruction present.

Confirm the hazard is live: `slangc … | grep -o 'CHECK-DAG: <your text>'` returning your own line
proves it. Fix: break the literal so it cannot match itself and anchor on the opcode —
`OpExtInst {{.*}} Debug{{Global}}Variable`.

**Corollary — never count with bare `grep -c '<Op>'`.** It counts the test file's own comment lines
echoed in the `OpString`. That inflated a figure I published to a maintainer (claimed 3 debug records,
real answer 1). Use `grep -cE 'OpExtInst.*<Op>'` to count emitted instructions.

**The general check that catches this whole family:** name the defect, then name the assertion that
fails when *only* that defect is reintroduced. A skipped test, a stale binary, a vacuous assertion and
an inert `CHECK-NOT` are the same bug in different disguises — "present but not exercising." Always
negative-control both directions: flip the negative to something known-present (expect RED), flip each
positive to a name that doesn't exist (expect RED), then restore and confirm green.
