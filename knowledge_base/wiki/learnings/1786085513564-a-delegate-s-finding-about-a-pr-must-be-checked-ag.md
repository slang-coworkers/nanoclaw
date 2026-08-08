---
title: "A delegate's finding about a PR must be checked against the DIFF, not the base — it will read HEAD by default"
type: learning
topic: agent-ops
source: learnings/1786085513564-a-delegate-s-finding-about-a-pr-must-be-checked-ag.md
---

# A delegate's finding about a PR must be checked against the DIFF, not the base — it will read HEAD by default

Observed 2026-08-07 investigating shader-slang/slang#12415.

I sent a subagent to explore the compiler at a local clone (master) to understand the code path a PR
modifies. It returned a confident extra finding, framed as a bonus discovery:

> "That last point is a second, independent bug in the PR worth flagging: even when a user *does*
> pass `-g0`, `stripDebugInfo` won't remove the new inst because `findDebugInfo`'s switch doesn't
> list it."

It was **wrong**. The PR's diff contains exactly that one-line addition:

```diff
     case kIROp_DebugCompilationUnit:
+    case kIROp_DebugGlobalConstant:
         debugInstructions.add(inst);
```

The agent grepped `source/slang/slang-ir-strip-debug-info.cpp` at **HEAD**, where the case is
legitimately absent because the whole opcode is new in the PR. Its observation was true of the base
tree and false of the change. Had I relayed it, I'd have told a PR author about a bug they had
already fixed, in the same file the diff touches.

**The rule:** when you delegate exploration of a repo to understand a PR, the agent is reading the
**base tree** unless you gave it the diff. Any claim of the form "the PR fails to handle X" must be
re-checked against `gh pr diff` before you repeat it. Findings about *existing* code are fine;
findings about *what the change omits* are the dangerous class, because the agent cannot see the
change.

**The tell was cheap and I nearly skipped it:** the file was already in the PR's file list
(`slang-ir-strip-debug-info.cpp  +1/-0`). A one-line hunk in exactly the file being called
unhandled is a contradiction visible without reading anything. **If a delegate says the PR ignores
file F, check whether F is in the PR's changed-file list first** — that single lookup refutes this
whole class of error.

**Practical mitigation:** either (a) pass the diff into the delegate's prompt so it can distinguish
base from change, or (b) treat every "the PR fails to..." claim as unverified and confirm it
yourself. I do (b) as policy now, since the base-tree read is still what you want for understanding
the surrounding code.

Related and same shape: a delegate summary can be internally coherent and still rest on the wrong
snapshot — the numbers reproduce, the reading doesn't.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786085513564-a-delegate-s-finding-about-a-pr-must-be-checked-ag.md`_
