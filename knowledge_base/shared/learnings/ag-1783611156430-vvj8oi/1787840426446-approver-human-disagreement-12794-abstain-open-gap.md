---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787827134413-sfyhi4
written_at: 2026-08-27T14:20:26.446Z
---

# [approver/human-disagreement] #12794 ABSTAIN(OPEN_GAP) overruled by clean merge — a best-effort producer path with silent fall-through is itself evidence the un-asserted output is incidental

## Outcome (join)
shader-slang/slang#12794 @9c83a63c9d9a: I decided **ABSTAIN_POLICY(OPEN_GAP)**. It **merged UNCHANGED** at exactly my decided head (merge commit 47e4261, no interval commits, merged by the author jkiviluoto-nv), issue #12788 **CLOSED**, and **no follow-up issue was filed** for the `findFile`/folded-source question my abstain flagged; no maintainer raised it in comments. Two MEMBERs (jvepsalainen-nv LGTM + the author) treated it as mergeable as-is. Under the falsifiable reading ("material enough not to merge as-is"), merge-unchanged **refutes** the OPEN_GAP ⇒ this is a human-disagreement; my abstain was over-conservative. Cost was low (abstain never blocks), but it is still a miss to calibrate.

## What the PR was
Test-only: dropped Test 4's assertion that a module's folded `.slang` source appears in the depfile (it fails on Windows-ARM64 only; Fixes #12788, a regression from #12666), keeping the `.slang-module` assertion.

## Root cause of the over-abstain
Filed [[approver/challenger-miss]] correctly said "read the producer before clearing an assertion-removal gap." I did — and found `slang-session.cpp:2250-2274` adds the folded-source dep **best-effort**: `loadSourceFile()`→`IncludeSystem::findFile()`, then `if (sourceFile) module->addFileDependency(sourceFile);` with **silent fall-through** (tries direct path, then relative-to-module-source, then just skips; no error, no assert). I then over-weighted a single ambiguity ("but the source is physically present, so failing to resolve *might* be a findFile bug") and abstained. The outcome says the maintainers read the same producer and judged the divergence incidental — no producer fix warranted.

## Refinement (the transferable calibration)
When reading the producer of a removed test assertion, the **shape of the producing code carries the answer**, not just the presence of a code path:
- **Best-effort add with silent fall-through** (no error/diagnostic when the input doesn't resolve) = the producer itself declares the output OPTIONAL. That is strong evidence the un-asserted behavior is **incidental** → leans CLEAR, even if the input happens to be present on some platforms. A deliberate code path is NOT the same as a *contractual* one — `if (x) add(x);` is deliberate-but-optional.
- **Hard requirement** (error/assert/diagnostic when the output is absent) = removing its assertion tests away a contract → OPEN_GAP holds.
So: distinguish "deliberate" from "contractual." The earlier learning's dichotomy ("deliberate path ⇒ maybe a masked bug") was too coarse; the discriminator is whether the producer **tolerates absence silently**. Here it does ⇒ WOULD_APPROVE would have matched the humans.

## How to catch it next time
For an assertion-removal PR, after opening the producer: grep the emit path for whether the un-asserted output is added conditionally with silent fall-through vs. required-with-diagnostic. Silent-optional + consumed-edge-still-asserted + maintainers framing it incidental ⇒ clear the gap. Reserve OPEN_GAP for removals of a contractually-required (diagnosed/asserted) output, or where the consumed/rebuild-critical edge itself is dropped. Don't let a single "but the input is present" hypothetical override an explicitly-optional producer shape.
