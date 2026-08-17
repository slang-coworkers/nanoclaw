---
title: "A passing test tells you the path worked, not which path ran — right answer, unestablished warrant"
type: learning
topic: misc
source: learnings/1786002689464-a-passing-test-tells-you-the-path-worked-not-which.md
---

# A passing test tells you the path worked, not which path ran — right answer, unestablished warrant

**Rule:** When a test passes and you conclude something is safe, you have evidence that *the path exercised* worked. You do not yet know **which** path ran. If two paths could have served the same observation and only one of them is safe, your conclusion is unwarranted even when it is correct.

**Concrete instance (shader-slang/slang#12382, 2026-08-06).** Two in-tree `.slang` tests had `-skip-spirv-validation` dropped so they would validate the SPIR-V link path. A reviewer certified this safe on solid-looking evidence: the tests **pass** with `SLANG_RUN_SPIRV_VALIDATION=1` and **fail** on a build with the fix reverted. Both true, both reproduced independently.

Nobody asked *why* those tests survive a code path where the equivalent API call **aborts the process**. Measured later, same input, same environment, same instant:

| entry point | result |
|---|---|
| `slangc` CLI | exit **255**, graceful `error[E99997]` |
| `IModulePrecompileService_Experimental::precompileForTarget` (public API) | exit **134**, `Aborted (core dumped)` — `AbortCompilationException` escapes the C ABI |

The CLI is wrapped by an exception handler that `precompileForTarget` lacks. `slang-test` drives the CLI, i.e. the **protected** path — which is the actual reason the flag drops are safe. Had the wrapping gone the other way, `slang-test` would have driven the aborting path, the flag drops would have been unsafe, and **the evidence would have read identically**: same pass, same revert-drill failure. The conclusion was right; the warrant was never established.

**Why this is distinct from a vacuous test.** A vacuous test cannot fail — you catch it with a revert drill. This test *did* fail on revert, so falsifiability was proven and the usual check passed. The gap is one level up: falsifiability tells you the test is sensitive to the change, not that the path it exercises is the path your safety claim is about.

**How to apply:**
- After a pass licenses a safety claim, ask: **which entry point / configuration / code path did that actually exercise, and is it the one my claim covers?** Name it explicitly.
- When two entry points reach the same functionality (CLI vs public API, in-process vs spawned, wrapped vs unwrapped), test the one your claim is about — or state which one you tested and scope the claim to it.
- Tell: your conclusion holds but you cannot say *why* the failure didn't occur. "It passed, so it's fine" without a mechanism is a right answer waiting for the mechanism to change underneath it.
- The generalisation that covers this and its siblings: **an observation constrains the world less than it appears to when more than one mechanism predicts it.** Same family as "source says what could happen, the log says what did" — prefer the check that discriminates *between* mechanisms over the one that merely agrees with your hypothesis.

Credit: identified by the reviewer whose safety claim it was, self-reported after a third party measured the CLI-vs-API difference.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786002689464-a-passing-test-tells-you-the-path-worked-not-which.md`_
