# Compile the reported snippet all the way to codegen — a quoted warning may be hiding an ICE

## The miss

slang#8785 quoted `warning 38040: parameter 'payload' is treated as 'uniform'` for the documented
amplification-shader form `out payload TaskData payload`. A first automated triage read the warning,
traced the mechanism in the checker by source read, and concluded **"the documentation is wrong, not
the compiler."** That conclusion was wrong.

Actually running the snippet through codegen at master HEAD 546ad18f7:

| target | result |
|---|---|
| `spirv` | **ICE** `assert failure: slang-ir-glsl-legalize.cpp(5235): call->getArgCount() == 4` |
| `metal` | **ICE** `slang-ir-legalize-varying-params.cpp(4566)` (different assert, same root) |
| `hlsl` | exit 0, emits writes into a read-only `cbuffer` → bundled `dxc 1.9` **rejects** it |
| `glsl` | exit 0, emits writes into a `push_constant` block — same defect, silently |

And on the **released** `slangc 2026.13.1`: **SIGSEGV, exit 139, core dumped.**

**Rule: a reporter quoting a warning does not mean the compiler stopped at a warning.** Reporters
quote the first thing they see. Compile their exact snippet to every plausible target and check the
true exit code before deciding "compiler is fine, docs are wrong."

## Two traps that hid the severity

1. **`| head` masks exit status.** `slangc ... 2>&1 | head -12` reported `EXIT=0` on a run that had
   actually segfaulted — the pipeline's status is `head`'s. Redirect to a file and check `$?` directly:
   `slangc ... > log 2>&1; echo "EXIT=$?"`. The segfault only became visible that way (bash printed
   `Segmentation fault (core dumped)`).
2. **`SLANG_ASSERT` is not a release diagnostic.** `source/core/slang-common.h:364` vs `:371` —
   in release builds it becomes `SLANG_ASSUME(...)`, i.e. the violated invariant is **UB**, not a
   message. So "it's only a debug assert" is backwards: debug gives you a clean error, release gives
   you a crash. Always test a release binary too when you find an ICE.

## Isolating an ICE: probe the matrix, and get a control

Don't attribute the crash to the most conspicuous syntax. Here the obvious suspect was the `payload`
modifier. Probe matrix on the amplification stage, all calling `DispatchMesh(1,1,1,payload)`:

- `out payload T`, `in payload T`, `inout payload T`, bare `payload T`, **and `out T` (no modifier)** → all ICE
- `in T` → warns, compiles, but emits the payload as a **PushConstant** (silently wrong)
- `uniform T`, plain local var, `groupshared` global → all clean
- `out payload` param present but `DispatchMesh` given a *groupshared* var → clean; `out payload` param with no `DispatchMesh` call → clean

⇒ real trigger is **"the value passed to `DispatchMesh` is an entry-point parameter"**, not the
modifier. A fix teaching the checker about `payload` alone would leave `out T p` crashing. The
no-modifier cell is what proves it — **include the cell that removes your prime suspect.**

## Pinning which pass broke an invariant: diff the signature across the dump

`-dump-ir` (with `-target` AND `-o`, per repo CLAUDE.md) prints `### AFTER <pass>:` sections. To find
where an arity/type invariant died, project the one line you care about against the pass name:

```bash
awk '/^### AFTER/{pass=$3} /func %DispatchMesh/{print pass"\t"$0}' ir.dump \
  | sed 's/RefParam([^)]*)/REFPARAM/' | awk '{if($0!=prev)print; prev=$0}'
```

Collapsing consecutive duplicates makes the transition a single visible line: 4-param through
`specializeResourceUsage`, 3-param immediately after **`specializeFuncsForBufferLoadArgs`**.

**Always run the same sweep on the WORKING input as a control.** For the `groupshared` form the arity
never drops (`grep -c` → 0), which rules out "this pass always does that."

## Adjudicate subagent attributions against the dump, not against plausibility

An Explore agent confidently attributed the arity drop to `legalizeEntryPointsForGLSL` and reasoned a
tidy story around it ("the payload is now a global, so the call needn't pass it"). Wrong: the dump
shows the drop already complete before that pass even runs (dump line 5649 vs 6262). **The pass
schedule in the dump of the actual run beats the schedule you infer from reading `slang-emit.cpp`
line numbers** — `SLANG_PASS(...)` at a lower line number is not proof of what ran when, since passes
sit behind target conditionals. I kept the agent's version out of the public comment and recorded it
as retracted in the memo.

## Where the doc bug actually lived

`grep taskPayloadSharedEXT` across shader-slang/slang finds only source + one test — **the bad page is
in a different repo**: `shader-slang/shader-slang.github.io`, `docs/coming-from-glsl.md:942-954` (code
block) and `:959` (the bullet). Found with `gh api "search/code?q=taskPayloadSharedEXT+org:shader-slang"`.
When a reporter cites a `docs.shader-slang.org` URL and it isn't in the compiler tree, search the org
before concluding the text doesn't exist — and say plainly that the fix isn't a PR in this repo.

## Bonus: the reporter's subtler claim was also right

Both in-tree amplification tests dispatch exactly **one** task thread (`task-simple.slang:37`
`AMPLIFICATION_NUM_THREADS_X = 1`; `task-groupshared.slang:34` `[numthreads(1,1,1)]`). With
`[numthreads(32,1,1)]` and a local payload, emitted SPIR-V is a single unsynchronized `OpStore` to the
shared payload from all 32 threads with **no `OpControlBarrier`**. When a reporter flags a test as
"works only because there is exactly one thread," check the thread count — they may have found a
coverage hole, not a misunderstanding.
